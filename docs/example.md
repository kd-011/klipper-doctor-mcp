# What a diagnosis looks like

`diagnose_log` returns a short Markdown report as text, and the whole report as structured JSON (every finding with its rule id, severity, fix, docs link and the log lines it came from). Which one your agent shows you depends on the client.

The text below is the output of this server on `test/fixtures/heater-verify.log`, a synthetic log built from the message formats in the Klipper source, not anyone's real log. `npm run assets` regenerates it and a test fails if it goes stale.

<!-- demo:start -->
```markdown
**klipper-doctor**: 2 errors, 0 warnings, 2 notes (Klipper v0.12.0-250-g1a2b3c4d)

**Errors (2)**
- **Heater extruder not heating at expected rate** (crash, line 102): Klipper's verify_heater check shut the printer down because extruder was not heating as expected. Fix: Check the heater cartridge or bed wiring, that the thermistor reads sensibly and is seated, and that the heater actually warms up. Change verify_heater only as a last step.
- **pid_integral_max was removed from Klipper in [extruder]** (config, line 70): Config_Changes lists pid_integral_max as removed on 2021-11-02. Fix: Delete the line.

**Notes (2)**
- **[tmc2209 stepper_x] has stealthchop_threshold 500** (config, line 87): [tmc2209 stepper_x] sets stealthchop_threshold to 500, so the driver is in stealthChop below 500 mm/s and spreadCycle above it. Fix: Remove stealthchop_threshold from [tmc2209 stepper_x] or set it to 999999.
- **No [input_shaper] section** (config): Input shaping is optional. Fix: See Resonance Compensation if you see ringing on prints.

Checked with [klipper-doctor](https://github.com/kd-011/klipper-doctor) 0.4.0

Rule ids: heater-verify, removed-option, tmc-stealthchop-threshold, no-input-shaper (explain_rule gives the full text).
```
<!-- demo:end -->

Each rule id can be looked up with `explain_rule`.
