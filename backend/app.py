import os, math, json, signal, sys, time
from datetime import datetime, timezone
from flask import Flask, request, jsonify, send_from_directory, g
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from flask_socketio import SocketIO, emit, join_room, leave_room
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from dotenv import load_dotenv
import bcrypt

load_dotenv()

def utcnow():
    return datetime.now(timezone.utc).replace(tzinfo=None)

BASE_DIR     = os.path.abspath(os.path.dirname(__file__))
FRONTEND_DIR = os.path.join(os.path.dirname(BASE_DIR), 'frontend', 'dist')

app = Flask(__name__, static_folder=None)
app.config['SECRET_KEY']                     = os.getenv('SECRET_KEY', 'navbus-secret-2025')
app.config['SQLALCHEMY_DATABASE_URI']        = os.getenv('DATABASE_URL', f"sqlite:///{os.path.join(BASE_DIR, 'navbus.db')}")
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['RATELIMIT_ENABLED']              = os.getenv('RATELIMIT_ENABLED', 'true').lower() == 'true'

CORS(app, origins='*',
     allow_headers=['Content-Type', 'Authorization'],
     methods=['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
     supports_credentials=False)

db      = SQLAlchemy(app)
limiter = Limiter(app=app, key_func=get_remote_address,
                  default_limits=["200 per minute"], storage_uri="memory://",
                  enabled=app.config['RATELIMIT_ENABLED'])
socketio = SocketIO(app, cors_allowed_origins='*', async_mode='threading',
                    ping_timeout=25, ping_interval=10,
                    logger=False, engineio_logger=False)

# ── MODELS ────────────────────────────────────────────────────────────────────

class User(db.Model):
    __tablename__ = 'users'
    id         = db.Column(db.Integer, primary_key=True)
    username   = db.Column(db.String(80),  unique=True, nullable=False, index=True)
    password   = db.Column(db.String(200), nullable=False)
    role       = db.Column(db.String(20),  default='passenger')
    created_at = db.Column(db.DateTime,    default=utcnow)

    def set_password(self, raw):
        self.password = bcrypt.hashpw(raw.encode(), bcrypt.gensalt()).decode()

    def check_password(self, raw):
        try:
            return bcrypt.checkpw(raw.encode(), self.password.encode())
        except Exception:
            return False

class Route(db.Model):
    __tablename__ = 'routes'
    id          = db.Column(db.Integer, primary_key=True)
    route_name  = db.Column(db.String(200), nullable=False)
    start_point = db.Column(db.String(100), nullable=False)
    end_point   = db.Column(db.String(100), nullable=False)
    stops       = db.relationship('Stop', backref='route', lazy=True, order_by='Stop.order')
    buses       = db.relationship('Bus',  backref='route', lazy=True)

class Stop(db.Model):
    __tablename__ = 'stops'
    id       = db.Column(db.Integer, primary_key=True)
    route_id = db.Column(db.Integer, db.ForeignKey('routes.id'), nullable=False, index=True)
    name     = db.Column(db.String(100), nullable=False)
    lat      = db.Column(db.Float, nullable=False)
    lng      = db.Column(db.Float, nullable=False)
    order    = db.Column(db.Integer, nullable=False)

class Bus(db.Model):
    __tablename__ = 'buses'
    id              = db.Column(db.Integer, primary_key=True)
    name            = db.Column(db.String(100), nullable=False)
    bus_number      = db.Column(db.String(50),  nullable=False)
    route_id        = db.Column(db.Integer, db.ForeignKey('routes.id'), nullable=False)
    operating_hours = db.Column(db.String(50),  default='5:00 - 21:00')
    schedule_json   = db.Column(db.Text,        default='[]')
    live_lat        = db.Column(db.Float,    nullable=True)
    live_lng        = db.Column(db.Float,    nullable=True)
    live_speed      = db.Column(db.Float,    nullable=True)
    live_updated_at = db.Column(db.DateTime, nullable=True)
    source_type     = db.Column(db.String(20), default='schedule')
    is_active       = db.Column(db.Boolean,    default=False)

    def get_schedule(self):
        try:
            return json.loads(self.schedule_json)
        except Exception:
            return []

class ActiveTrip(db.Model):
    __tablename__ = 'active_trips'
    id            = db.Column(db.Integer, primary_key=True)
    driver_id     = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    bus_id        = db.Column(db.Integer, db.ForeignKey('buses.id'), nullable=False)
    route_id      = db.Column(db.Integer, db.ForeignKey('routes.id'), nullable=False)
    started_at    = db.Column(db.DateTime, default=utcnow)
    ended_at      = db.Column(db.DateTime, nullable=True)
    is_active     = db.Column(db.Boolean,  default=True)
    current_lat   = db.Column(db.Float, nullable=True)
    current_lng   = db.Column(db.Float, nullable=True)
    current_speed = db.Column(db.Float, nullable=True)

# ── HELPERS ───────────────────────────────────────────────────────────────────

def get_json():
    try:
        d = request.get_json(force=True, silent=True)
        return d if isinstance(d, dict) else {}
    except Exception:
        return {}

def validate_coords(lat, lng):
    try:
        la, lo = float(lat), float(lng)
        if -90 <= la <= 90 and -180 <= lo <= 180:
            return True, la, lo
        return False, None, None
    except Exception:
        return False, None, None

def haversine(lat1, lng1, lat2, lng2):
    R  = 6371
    d1 = math.radians(lat2 - lat1)
    d2 = math.radians(lng2 - lng1)
    a  = (math.sin(d1/2)**2
          + math.cos(math.radians(lat1))
          * math.cos(math.radians(lat2))
          * math.sin(d2/2)**2)
    return R * 2 * math.asin(math.sqrt(max(0, a)))

ROAD_FACTOR       = 1.3   # roads ~30% longer than straight line
PASSED_RADIUS_KM  = 0.08  # 80m — stop is "passed" when bus is within this

def bus_is_live(b):
    if not b.is_active or not b.live_lat or not b.live_lng or not b.live_updated_at:
        return False
    return (utcnow() - b.live_updated_at).total_seconds() < 300

def get_stop_statuses(stops, bus_lat, bus_lng, speed_kmh):
    """
    For each stop return: id, name, lat, lng, order, status, eta_minutes, distance_km
    status: 'passed' | 'next' | 'upcoming'

    Logic:
      1. Walk stops in order.
      2. If bus is within PASSED_RADIUS_KM → passed.
      3. First stop NOT passed → next (ETA from bus to that stop).
      4. All later stops → upcoming (ETA chained through intermediate hops).
    """
    if not bus_lat or not bus_lng or not stops:
        return [{'id': s.id, 'name': s.name, 'lat': s.lat, 'lng': s.lng,
                 'order': s.order, 'status': 'upcoming',
                 'eta_minutes': None, 'distance_km': None} for s in stops]

    speed = speed_kmh if (speed_kmh and speed_kmh > 2) else 20.0
    result     = []
    next_found = False

    for i, stop in enumerate(stops):
        dist_straight = haversine(bus_lat, bus_lng, stop.lat, stop.lng)
        dist_road     = dist_straight * ROAD_FACTOR

        if dist_straight < PASSED_RADIUS_KM:
            result.append({'id': stop.id, 'name': stop.name,
                           'lat': stop.lat, 'lng': stop.lng, 'order': stop.order,
                           'status': 'passed', 'eta_minutes': None,
                           'distance_km': round(dist_road, 3)})

        elif not next_found:
            next_found = True
            eta = max(1, round((dist_road / speed) * 60))
            result.append({'id': stop.id, 'name': stop.name,
                           'lat': stop.lat, 'lng': stop.lng, 'order': stop.order,
                           'status': 'next', 'eta_minutes': eta,
                           'distance_km': round(dist_road, 3)})

        else:
            # Chain distance: bus→next + sum of hops from next→this stop
            next_idx = next((j for j, r in enumerate(result) if r['status'] == 'next'), None)
            if next_idx is not None:
                total = result[next_idx]['distance_km']
                for j in range(next_idx, i):
                    if j + 1 < len(stops):
                        hop = haversine(stops[j].lat, stops[j].lng,
                                        stops[j+1].lat, stops[j+1].lng) * ROAD_FACTOR
                        total += hop
            else:
                total = dist_road
            eta = max(1, round((total / speed) * 60))
            result.append({'id': stop.id, 'name': stop.name,
                           'lat': stop.lat, 'lng': stop.lng, 'order': stop.order,
                           'status': 'upcoming', 'eta_minutes': eta,
                           'distance_km': round(total, 3)})
    return result

def now_minutes():
    n = datetime.now()
    return n.hour * 60 + n.minute

def get_next_departure(schedule):
    nm = now_minutes()
    for t in schedule:
        h, m = map(int, t.split(':'))
        if h * 60 + m > nm:
            return t
    return schedule[0] if schedule else None

def schedule_with_status(schedule):
    nm    = now_minutes()
    found = False
    out   = []
    for t in schedule:
        h, m = map(int, t.split(':'))
        dep  = h * 60 + m
        if dep < nm:
            out.append({'time': t, 'status': 'past'})
        elif not found:
            out.append({'time': t, 'status': 'next'})
            found = True
        else:
            out.append({'time': t, 'status': 'future'})
    return out

def push_bus_update(bus_id, payload):
    try:
        socketio.emit('bus_update', payload, room=f'bus_{bus_id}')
    except Exception as e:
        app.logger.error(f"Push failed bus {bus_id}: {e}")

def build_payload(bus_id, b, stops):
    live      = bus_is_live(b)
    speed_kmh = (b.live_speed or 0)
    if live:
        stop_statuses = get_stop_statuses(stops, b.live_lat, b.live_lng, speed_kmh)
    else:
        stop_statuses = [{'id': s.id, 'name': s.name, 'lat': s.lat, 'lng': s.lng,
                          'order': s.order, 'status': 'upcoming',
                          'eta_minutes': None, 'distance_km': None} for s in stops]
    next_stop = next((s for s in stop_statuses if s['status'] == 'next'), None)
    return {
        'bus_id':         bus_id,
        'lat':            b.live_lat  if live else None,
        'lng':            b.live_lng  if live else None,
        'speed_kmh':      round(speed_kmh, 1),
        'is_active':      live,
        'source_type':    b.source_type,
        'ts':             b.live_updated_at.isoformat() if b.live_updated_at else None,
        'stops':          stop_statuses,
        'next_stop':      next_stop,
        'next_stop_name': next_stop['name']        if next_stop else None,
        'next_stop_eta':  next_stop['eta_minutes'] if next_stop else None,
    }

# ── AUTH ──────────────────────────────────────────────────────────────────────

@app.route('/api/auth/register', methods=['POST', 'OPTIONS'])
@limiter.limit("5 per minute")
def register():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    d        = get_json()
    username = d.get('username', '').strip()
    password = d.get('password', '').strip()
    role     = d.get('role', 'passenger').strip()
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    if len(username) < 3:
        return jsonify({'error': 'Username must be at least 3 characters'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400
    if role not in ('passenger', 'driver'):
        return jsonify({'error': 'Role must be passenger or driver'}), 400
    if User.query.filter_by(username=username).first():
        return jsonify({'error': 'Username already taken'}), 409
    u = User(username=username, role=role)
    u.set_password(password)
    db.session.add(u)
    db.session.commit()
    return jsonify({'message': 'Registered', 'user': {'id': u.id, 'username': u.username, 'role': u.role}}), 201

@app.route('/api/auth/login', methods=['POST', 'OPTIONS'])
@limiter.limit("10 per minute")
def login():
    if request.method == 'OPTIONS':
        return jsonify({}), 200
    d        = get_json()
    username = d.get('username', '').strip()
    password = d.get('password', '').strip()
    if not username or not password:
        return jsonify({'error': 'Username and password required'}), 400
    u = User.query.filter_by(username=username).first()
    if not u or not u.check_password(password):
        return jsonify({'error': 'Invalid username or password'}), 401
    return jsonify({'user': {'id': u.id, 'username': u.username, 'role': u.role}})

# ── ROUTES ────────────────────────────────────────────────────────────────────

@app.route('/api/routes')
def get_routes():
    return jsonify([{'id': r.id, 'route_name': r.route_name,
                     'start_point': r.start_point, 'end_point': r.end_point,
                     'stop_count': len(r.stops)} for r in Route.query.all()])

@app.route('/api/routes/<int:rid>')
def get_route(rid):
    r = db.session.get(Route, rid)
    if not r:
        return jsonify({'error': 'Route not found'}), 404
    return jsonify({'id': r.id, 'route_name': r.route_name,
                    'start_point': r.start_point, 'end_point': r.end_point,
                    'stops': [{'id': s.id, 'name': s.name, 'lat': s.lat,
                               'lng': s.lng, 'order': s.order} for s in r.stops]})

# ── STOPS ─────────────────────────────────────────────────────────────────────

@app.route('/api/stops/all')
def all_stops():
    stops = Stop.query.order_by(Stop.name).all()
    seen, out = set(), []
    for s in stops:
        if s.name.lower() not in seen:
            seen.add(s.name.lower())
            out.append({'id': s.id, 'name': s.name, 'lat': s.lat, 'lng': s.lng})
    return jsonify(out)

@app.route('/api/stops/search')
def search_stops():
    frm = request.args.get('from', '').lower().strip()
    to  = request.args.get('to',   '').lower().strip()
    if not frm or not to or len(frm) < 2 or len(to) < 2:
        return jsonify([])
    results = []
    for route in Route.query.all():
        names = [s.name.lower() for s in route.stops]
        fi    = next((i for i, n in enumerate(names) if frm in n), None)
        ti    = next((i for i, n in enumerate(names) if to  in n), None)
        if fi is not None and ti is not None and fi < ti:
            seg   = route.stops[fi:ti+1]
            buses = []
            for b in route.buses:
                live  = bus_is_live(b)
                sched = b.get_schedule()
                buses.append({
                    'id': b.id, 'name': b.name, 'bus_number': b.bus_number,
                    'is_active': live, 'source_type': b.source_type,
                    'operating_hours': b.operating_hours,
                    'next_departure': get_next_departure(sched),
                    'live_lat': b.live_lat if live else None,
                    'live_lng': b.live_lng if live else None,
                })
            results.append({
                'route_id':   route.id,
                'route_name': route.route_name,
                'start_point': route.start_point,
                'end_point':   route.end_point,
                'stops':      [{'id': s.id, 'name': s.name, 'lat': s.lat, 'lng': s.lng, 'order': s.order} for s in seg],
                'all_stops':  [{'id': s.id, 'name': s.name, 'lat': s.lat, 'lng': s.lng, 'order': s.order} for s in route.stops],
                'buses':      buses,
            })
    return jsonify(results)

# ── BUSES ─────────────────────────────────────────────────────────────────────

@app.route('/api/buses')
def get_buses():
    out = []
    for b in Bus.query.all():
        sched = b.get_schedule()
        out.append({
            'id': b.id, 'name': b.name, 'bus_number': b.bus_number,
            'route_id': b.route_id, 'operating_hours': b.operating_hours,
            'is_active': bus_is_live(b), 'source_type': b.source_type,
            'next_departure': get_next_departure(sched),
        })
    return jsonify(out)

@app.route('/api/buses/<int:bid>')
def get_bus(bid):
    b = db.session.get(Bus, bid)
    if not b:
        return jsonify({'error': 'Bus not found'}), 404
    route = db.session.get(Route, b.route_id)
    stops = list(route.stops) if route else []
    live  = bus_is_live(b)
    sched = b.get_schedule()
    stop_statuses = (get_stop_statuses(stops, b.live_lat, b.live_lng, b.live_speed)
                     if live else
                     [{'id': s.id, 'name': s.name, 'lat': s.lat, 'lng': s.lng,
                       'order': s.order, 'status': 'upcoming',
                       'eta_minutes': None, 'distance_km': None} for s in stops])
    next_stop = next((s for s in stop_statuses if s['status'] == 'next'), None)
    return jsonify({
        'id': b.id, 'name': b.name, 'bus_number': b.bus_number,
        'route_id': b.route_id,
        'route_name':  route.route_name  if route else '',
        'start_point': route.start_point if route else '',
        'end_point':   route.end_point   if route else '',
        'operating_hours': b.operating_hours,
        'schedule':        schedule_with_status(sched),
        'next_departure':  get_next_departure(sched),
        'is_active':       live,
        'source_type':     b.source_type,
        'live_lat':        b.live_lat   if live else None,
        'live_lng':        b.live_lng   if live else None,
        'live_speed':      b.live_speed if live else None,
        'stops':           stop_statuses,
        'next_stop':       next_stop,
        'next_stop_name':  next_stop['name']        if next_stop else None,
        'next_stop_eta':   next_stop['eta_minutes'] if next_stop else None,
    })

# ── DRIVER TRIP ───────────────────────────────────────────────────────────────

@app.route('/api/driver/start-trip', methods=['POST'])
@limiter.limit("10 per minute")
def start_trip():
    d = get_json()
    driver_id = d.get('driver_id')
    bus_id    = d.get('bus_id')
    route_id  = d.get('route_id')
    if not driver_id or not bus_id or not route_id:
        return jsonify({'error': 'driver_id, bus_id, route_id required'}), 400
    # End any previous active trip for this driver
    old = ActiveTrip.query.filter_by(driver_id=driver_id, is_active=True).first()
    if old:
        old.is_active = False
        old.ended_at  = utcnow()
        old_bus = db.session.get(Bus, old.bus_id)
        if old_bus:
            old_bus.is_active = False
            old_bus.source_type = 'schedule'
    bus = db.session.get(Bus, bus_id)
    if bus:
        bus.is_active   = True
        bus.source_type = 'driver_live'
    trip = ActiveTrip(driver_id=driver_id, bus_id=bus_id, route_id=route_id)
    db.session.add(trip)
    db.session.commit()
    return jsonify({'trip_id': trip.id, 'message': 'Trip started'})

@app.route('/api/driver/update-location', methods=['POST'])
@limiter.limit("120 per minute")
def driver_update():
    d    = get_json()
    trip = ActiveTrip.query.filter_by(id=d.get('trip_id'), is_active=True).first()
    if not trip:
        return jsonify({'error': 'No active trip'}), 404
    valid, lat, lng = validate_coords(d.get('lat'), d.get('lng'))
    if not valid:
        return jsonify({'error': 'Invalid coordinates'}), 400
    speed_kmh = float(d.get('speed', 0) or 0)
    trip.current_lat   = lat
    trip.current_lng   = lng
    trip.current_speed = speed_kmh
    bus = db.session.get(Bus, trip.bus_id)
    if bus:
        bus.live_lat        = lat
        bus.live_lng        = lng
        bus.live_speed      = speed_kmh
        bus.live_updated_at = utcnow()
        bus.source_type     = 'driver_live'
        bus.is_active       = True
    db.session.commit()
    route = db.session.get(Route, trip.route_id)
    stops = list(route.stops) if route else []
    push_bus_update(trip.bus_id, build_payload(trip.bus_id, bus, stops))
    return jsonify({'message': 'ok'})

@app.route('/api/driver/end-trip', methods=['POST'])
@limiter.limit("10 per minute")
def end_trip():
    d    = get_json()
    trip = ActiveTrip.query.filter_by(id=d.get('trip_id'), is_active=True).first()
    if not trip:
        return jsonify({'error': 'No active trip'}), 404
    trip.is_active = False
    trip.ended_at  = utcnow()
    bus = db.session.get(Bus, trip.bus_id)
    if bus:
        bus.is_active       = False
        bus.source_type     = 'schedule'
        bus.live_lat        = None
        bus.live_lng        = None
        bus.live_speed      = None
        bus.live_updated_at = None
    db.session.commit()
    push_bus_update(trip.bus_id, {'bus_id': trip.bus_id, 'is_active': False,
                                   'stops': [], 'next_stop': None})
    return jsonify({'message': 'Trip ended'})

# ── WEBSOCKET ─────────────────────────────────────────────────────────────────

@socketio.on('connect')
def on_connect():
    emit('connected', {'msg': 'NAVBUS live ✓'})

@socketio.on('disconnect')
def on_disconnect():
    pass

@socketio.on('watch_bus')
def on_watch(data):
    bus_id = data.get('bus_id')
    if not bus_id:
        return
    join_room(f'bus_{bus_id}')
    b = db.session.get(Bus, int(bus_id))
    if b and bus_is_live(b):
        route = db.session.get(Route, b.route_id)
        stops = list(route.stops) if route else []
        emit('bus_update', build_payload(bus_id, b, stops))

@socketio.on('unwatch_bus')
def on_unwatch(data):
    bus_id = data.get('bus_id')
    if bus_id:
        leave_room(f'bus_{bus_id}')

@socketio.on('driver_location')
def on_driver_location(data):
    bus_id    = data.get('bus_id')
    lat       = data.get('lat')
    lng       = data.get('lng')
    speed_kmh = float(data.get('speed', 0) or 0)
    if not all([bus_id, lat is not None, lng is not None]):
        return
    valid, lat_f, lng_f = validate_coords(lat, lng)
    if not valid:
        return
    b = db.session.get(Bus, int(bus_id))
    if b:
        b.live_lat        = lat_f
        b.live_lng        = lng_f
        b.live_speed      = speed_kmh
        b.live_updated_at = utcnow()
        b.source_type     = 'driver_live'
        b.is_active       = True
        db.session.commit()
        route = db.session.get(Route, b.route_id)
        stops = list(route.stops) if route else []
        emit('bus_update', build_payload(bus_id, b, stops), room=f'bus_{bus_id}')

# ── HEALTH ────────────────────────────────────────────────────────────────────


@app.route('/api/buses/<int:bid>/location', methods=['POST'])
@limiter.limit("60 per minute")
def update_bus_location(bid):
    """Passenger crowdsource location — used when no driver is active."""
    b = db.session.get(Bus, bid)
    if not b:
        return jsonify({'error': 'Bus not found'}), 404
    d = get_json()
    valid, lat, lng = validate_coords(d.get('lat'), d.get('lng'))
    if not valid:
        return jsonify({'error': 'Invalid coordinates'}), 400
    speed_kmh = float(d.get('speed', 20) or 20)
    source    = d.get('source_type', 'crowdsourced')

    # Only update if no active driver (driver takes priority)
    if not bus_is_live(b) or b.source_type == 'crowdsourced':
        b.live_lat        = lat
        b.live_lng        = lng
        b.live_speed      = speed_kmh
        b.live_updated_at = utcnow()
        b.source_type     = source
        b.is_active       = True
        db.session.commit()

        route = db.session.get(Route, b.route_id)
        stops = list(route.stops) if route else []
        push_bus_update(bid, build_payload(bid, b, stops))

    return jsonify({'message': 'ok'})

@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'time': utcnow().isoformat(), 'version': '3.0.0'})

@app.route('/')
def root():
    return jsonify({'app': 'NAVBUS Backend', 'status': 'running', 'version': '3.0.0'})

# SPA fallback for React frontend
@app.route('/<path:path>')
def spa(path):
    if path.startswith('api/') or path.startswith('socket.io'):
        return jsonify({'error': 'Not found'}), 404
    full = os.path.join(FRONTEND_DIR, path)
    if path and os.path.exists(full):
        return send_from_directory(FRONTEND_DIR, path)
    idx = os.path.join(FRONTEND_DIR, 'index.html')
    if os.path.exists(idx):
        return send_from_directory(FRONTEND_DIR, 'index.html')
    return jsonify({'error': 'Frontend not built yet'}), 404

# ── DB INIT ───────────────────────────────────────────────────────────────────

def init_db():
    db.create_all()
    if Route.query.count() > 0:
        return
    from seed_data import ROUTES, STOPS, BUSES
    for r in ROUTES:
        db.session.add(Route(**r))
    db.session.commit()
    for route_id, stop_list in STOPS.items():
        for s in stop_list:
            db.session.add(Stop(route_id=s[0], name=s[1], lat=s[2], lng=s[3], order=s[4]))
    db.session.commit()
    for b in BUSES:
        db.session.add(Bus(
            name=b['name'], bus_number=b['bus_number'], route_id=b['route_id'],
            operating_hours=b['operating_hours'],
            schedule_json=json.dumps(b['schedule']),
        ))
    db.session.commit()
    # Demo accounts
    for uname, pw, role in [('passenger', 'pass123', 'passenger'), ('driver', 'driver123', 'driver')]:
        u = User(username=uname, role=role)
        u.set_password(pw)
        db.session.add(u)
    db.session.commit()
    print('✅ NAVBUS database ready')

def shutdown(sig, frame):
    sys.exit(0)

signal.signal(signal.SIGTERM, shutdown)
signal.signal(signal.SIGINT,  shutdown)

with app.app_context():
    init_db()

if __name__ == '__main__':
    port  = int(os.getenv('PORT', 5000))
    debug = os.getenv('FLASK_DEBUG', 'false').lower() == 'true'
    print(f'🚌 NAVBUS → http://0.0.0.0:{port}')
    socketio.run(app, host='0.0.0.0', port=port, debug=debug, allow_unsafe_werkzeug=True)