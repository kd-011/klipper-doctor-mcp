// Builds test/fixtures/* from hand-written pieces. Nothing here comes from a
// real user's log: every line is assembled from the message formats in the
// Klipper source (klippy/klippy.py, mcu.py, configfile.py,
// extras/verify_heater.py), the same way klipper-doctor builds its own
// fixtures. Run: node scripts/make-fixtures.mjs
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const out = join(dirname(fileURLToPath(import.meta.url)), '..', 'test', 'fixtures');
mkdirSync(out, { recursive: true });

const VERSION = 'v0.12.0-250-g1a2b3c4d';
const note = (what, src) =>
  `# fixture: ${what}\n# made by scripts/make-fixtures.mjs from message formats in the Klipper source (${src}). Not a real user's log.\n`;

// What Klipper writes as the config dump: comments stripped, option names
// lowercased, "key = value", continuation lines tab-indented.
const CONFIG_DUMP = `[mcu]
serial = /dev/serial/by-id/usb-Klipper_stm32f103xe_ABC123-if00

[printer]
kinematics = cartesian
max_velocity = 300
max_accel = 3000

[stepper_x]
step_pin = PB13
dir_pin = !PB12
enable_pin = !PB14
microsteps = 16
rotation_distance = 40
endstop_pin = ^PC0
position_endstop = 0
position_max = 235
homing_speed = 50

[stepper_y]
step_pin = PB10
dir_pin = !PB2
enable_pin = !PB11
microsteps = 16
rotation_distance = 40
endstop_pin = ^PC1
position_endstop = 0
position_max = 235
homing_speed = 50

[stepper_z]
step_pin = PB0
dir_pin = PC5
enable_pin = !PB1
microsteps = 16
rotation_distance = 8
endstop_pin = ^PC2
position_endstop = 0.5
position_max = 250

[extruder]
step_pin = PB3
dir_pin = !PB4
enable_pin = !PD2
microsteps = 16
rotation_distance = 33.683
nozzle_diameter = 0.400
filament_diameter = 1.750
heater_pin = PC8
sensor_type = EPCOS 100K B57560G104F
sensor_pin = PA0
control = pid
pid_kp = 26.213
pid_ki = 1.304
pid_kd = 131.721
pid_integral_max = 0.2
min_temp = 0
max_temp = 270

[heater_bed]
heater_pin = PC9
sensor_type = ATC Semitec 104GT-2
sensor_pin = PC4
control = watermark
min_temp = 0
max_temp = 130

[tmc2209 stepper_x]
uart_pin = PC11
tx_pin = PC10
uart_address = 0
run_current = 0.580
stealthchop_threshold = 500

[gcode_macro START_PRINT]
gcode =
\tG28
\tG1 Z10 F600
\tM109 S{params.EXTRUDER|default(200)}`;

const PREAMBLE = `Starting Klippy...
Args: ['/home/pi/klipper/klippy/klippy.py', '/home/pi/printer_data/config/printer.cfg', '-I', '/home/pi/printer_data/comms/klippy.serial', '-l', '/home/pi/printer_data/logs/klippy.log', '-a', '/home/pi/printer_data/comms/klippy.sock']
Git version: '${VERSION}'
Branch: master
Remote: origin
Tracked URL: https://github.com/Klipper3d/klipper
CPU: 4 core ARMv7 Processor rev 4 (v7l)
Device: Raspberry Pi 3 Model B Rev 1.2
Linux: Linux version 6.1.21-v7+ (dom@buildbot) (arm-linux-gnueabihf-gcc-12 (Raspbian 12.2.0-14+rpi1) 12.2.0) #1642 SMP Mon Apr  3 17:20:52 BST 2023
Python: '3.9.2 (default, Feb 28 2021, 17:03:44) \\n[GCC 10.2.1 20210110]'
Start printer at Sun Nov  1 10:00:00 2026 (1793527200.0 5000.0)
===== Config file =====
${CONFIG_DUMP}
=======================
Loaded MCU 'mcu' 112 commands (${VERSION} / gcc: (15:7-2018-q2-1) 7.3.1 20180622 (release) [ARM/embedded-7-branch revision 261907] binutils: (2.31.1-0))
MCU 'mcu' config: ADC_MAX=4095 BUS_PINS_i2c1=PB6,PB7 CLOCK_FREQ=72000000 MCU=stm32f103xe PWM_MAX=255 SERIAL_BAUD=250000 STEPPER_BOTH_EDGE=1
MCU 'mcu' kconfig: {'CONFIG_MACH_STM32': 1, 'CONFIG_MCU': 'stm32f103xe'}
Configured MCU 'mcu' (1024 moves)`;

const stats = (t) =>
  `Stats ${t.toFixed(1)}: gcodein=0  mcu: mcu_awake=0.001 mcu_task_avg=0.000009 mcu_task_stddev=0.000012 bytes_write=1400 bytes_read=1800 bytes_retransmit=0 bytes_invalid=0 send_seq=100 receive_seq=100 retransmit_seq=0 srtt=0.001 rttvar=0.000 rto=0.025 ready_bytes=0 upcoming_bytes=0 freq=72000123 heater_bed: target=60 temp=59.8 pwm=0.250 sysload=0.22 cputime=2.5 memavail=800000`;
const goodRun = (from, n) => Array.from({ length: n }, (_, i) => stats(from + i)).join('\n');

const HEATER = `Heater extruder not heating at expected rate
Transition to shutdown state: Heater extruder not heating at expected rate
See the 'verify_heater' section in docs/Config_Reference.md
for the parameters that control this check.
Heater extruder not heating at expected rate
See the 'verify_heater' section in docs/Config_Reference.md
for the parameters that control this check.
Once the underlying issue is corrected, use the
"FIRMWARE_RESTART" command to reset the firmware, reload the
config, and restart the host software.
Printer is shutdown`;

const files = {
  // A heater verify shutdown, with a removed option and a mixed stealthchop threshold in the dumped config.
  'heater-verify.log':
    note('Heater extruder not heating at expected rate, plus config findings in the dumped config', 'extras/verify_heater.py, configfile.py') +
    `${PREAMBLE}\n${goodRun(5010, 3)}\n${HEATER}\n`,

  // The same session without the failure: nothing to find on the crash side.
  'clean.log':
    note('one complete session with no failure', 'klippy.py') + `${PREAMBLE}\n${goodRun(5010, 5)}\n`,

  // A printer.cfg (hand-written, with comments) with several things the config lint flags.
  'bad-printer.cfg': `# fixture: a printer.cfg with config problems
# made by scripts/make-fixtures.mjs. Not a real user's printer.cfg.
[mcu]
serial: /dev/serial/by-id/usb-Klipper_stm32f103xe_ABC123-if00

[printer]
kinematics: cartesian
max_velocity: 300
max_accel: 3000

[stepper_x]
step_pin: PB13
dir_pin: !PB12
enable_pin: !PB14
microsteps: 16
rotation_distance: 40
endstop_pin: ^PC0
position_endstop: 0
position_max: 235

[stepper_y]
step_pin: PB10
dir_pin: !PB2
enable_pin: !PB11
microsteps: 16
rotation_distance: 40
endstop_pin: ^PC1
position_endstop: 0
position_max: 235

[stepper_z]
step_pin: PB0
dir_pin: PC5
enable_pin: !PB1
microsteps: 16
rotation_distance: 8
endstop_pin: ^PC2
position_endstop: 0.5
position_max: 250

[extruder]
step_pin: PB3
dir_pin: !PB4
enable_pin: !PD2
microsteps: 16
rotation_distance: 33.683
nozzle_diameter: 0.400
filament_diameter: 1.750
heater_pin: PC8
sensor_type: EPCOS 100K B57560G104F
sensor_pin: PA0
control: pid
pid_kp: 26.213
pid_ki: 1.304
pid_kd: 131.721
pid_integral_max: 0.2
min_temp: 0
max_temp: 270

[heater_bed]
heater_pin: PC9
sensor_pin: PC4
control: watermark
min_temp: 0
max_temp: 130

[safe_z_home]
home_xy_position: 117, 117

[homing_override]
gcode:
  G28 X Y

[gcode_macro START_PRINT]
gcode:
  G28
G1 Z10 F600
`,
};

for (const [name, text] of Object.entries(files)) writeFileSync(join(out, name), text);
console.log(`wrote ${Object.keys(files).length} fixtures to ${out}`);
