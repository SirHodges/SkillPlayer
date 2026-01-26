import evdev
from evdev import ecodes
import threading
import time
import asyncio

# Screen Dimensions (Update if your display is different)
SCREEN_WIDTH = 1920
SCREEN_HEIGHT = 1080

class InputManager:
    def __init__(self, socketio):
        self.socketio = socketio
        self.running = True
        
        # Device Paths
        self.P1_PATH = '/dev/input/by-id/usb-PixArt_HP_320M_USB_Optical_Mouse-event-mouse'
        self.P2_PATH = '/dev/input/by-id/usb-PixArt_Microsoft_USB_Optical_Mouse-event-mouse'
        
        # Cursor State
        self.lock = threading.Lock()
        self.cursors = {
            'p1': {'x': SCREEN_WIDTH // 4, 'y': SCREEN_HEIGHT // 2},
            'p2': {'x': (SCREEN_WIDTH // 4) * 3, 'y': SCREEN_HEIGHT // 2}
        }
        
        # Start Threads
        threading.Thread(target=self._broadcast_loop, daemon=True).start()
        threading.Thread(target=self._device_listener, args=('p1', self.P1_PATH), daemon=True).start()
        threading.Thread(target=self._device_listener, args=('p2', self.P2_PATH), daemon=True).start()
        
    def _device_listener(self, player_id, device_path):
        """Monitor input device, auto-reconnecting on failure."""
        print(f"[{player_id.upper()}] Input listener started for {device_path}")
        
        while self.running:
            try:
                device = evdev.InputDevice(device_path)
                print(f"[{player_id.upper()}] Connected: {device.name}")
                
                # GRAB the device to prevent system cursor movement
                try:
                    device.grab()
                    print(f"[{player_id.upper()}] Device GRABBED (System cursor disabled for this device)")
                except Exception as e:
                    print(f"[{player_id.upper()}] WARNING: Could not grab device (System cursor will still move): {e}")

                # Consume events
                for event in device.read_loop():
                    if event.type == ecodes.EV_REL:
                        with self.lock:
                            if event.code == ecodes.REL_X:
                                self.cursors[player_id]['x'] += event.value
                                # Clamp X
                                self.cursors[player_id]['x'] = max(0, min(SCREEN_WIDTH, self.cursors[player_id]['x']))
                                
                            elif event.code == ecodes.REL_Y:
                                self.cursors[player_id]['y'] += event.value
                                # Clamp Y
                                self.cursors[player_id]['y'] = max(0, min(SCREEN_HEIGHT, self.cursors[player_id]['y']))
                                
                    elif event.type == ecodes.EV_KEY:
                        if event.code == ecodes.BTN_LEFT and event.value == 1: # Click down
                            # Send click IMMEDIATELY for responsiveness
                            self.socketio.emit(f'{player_id}_click', {})
                            
            except (OSError, FileNotFoundError):
                # Device unplugged or permission error
                print(f"[{player_id.upper()}] Connection lost or not found. Retrying in 2s...")
                time.sleep(2)
            except Exception as e:
                print(f"[{player_id.upper()}] Unexpected error: {e}")
                time.sleep(2)

    def _broadcast_loop(self):
        """Emit cursor positions at 60Hz to prevent network flood."""
        last_state = {}
        
        while self.running:
            start_time = time.time()
            
            # Create snapshot of current state
            with self.lock:
                current_state = {
                    'p1': self.cursors['p1'].copy(),
                    'p2': self.cursors['p2'].copy()
                }
            
            # Emit only if changed (simple optimization)
            if current_state != last_state:
                self.socketio.emit('state_update', current_state)
                last_state = current_state
            
            # Warning: Sleep duration is simplistic, but fine for 60Hz soft-realtime
            elapsed = time.time() - start_time
            sleep_time = max(0, (1.0/60.0) - elapsed)
            time.sleep(sleep_time)

def start_input_monitoring(socketio):
    """Factory to start the manager."""
    return InputManager(socketio)
