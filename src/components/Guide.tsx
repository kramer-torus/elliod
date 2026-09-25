import { useApp } from '../state';
import { PHASES, RACE_PREP_PHASE } from '../lib/plan';
import { DAILY_POSTURE } from '../lib/exercises';
import { formatPaceRange } from '../lib/vdot';

export default function Guide() {
  const { plan, state } = useApp();
  const z = plan?.paces.zones;
  const race = state.profile?.race;
  return (
    <div className="guide">
      <h1>The plan</h1>
      <p className="muted">Why the block looks the way it does. Read once, then trust the calendar.</p>

      <h2>The honest trade-off</h2>
      <p>
        You are asking for three things that pull against each other: keep marathon-level running, get stronger, and lose fat.
        Any two are easy. All three at once means each is pursued at a sustainable dose, not a maximal one.
      </p>
      <ul>
        <li><b>Running</b> drops from ~46 km/week to 32–40 km. That is enough to hold aerobic fitness and speed with one quality session and a long run, but it will not hold marathon-specific endurance forever. Expect 5k–10k ability to stay flat or improve; a marathon would need a proper build again.</li>
        <li><b>Strength</b> is the thing most likely to improve. You come off a block with little lifting, so novice gains are on the table even in a deficit. Progress will come from loads climbing week on week, not from soreness.</li>
        <li><b>Fat loss</b> is capped at roughly 0.4–0.5 kg/week. Faster than that and the runs go flat and the lifts stall. Aim for 75–76 kg from 80 across the block; a leaner frame also makes every run cheaper.</li>
      </ul>
      <div className="callout">
        Weeks 1–2 are recovery, not a warm-up you can skip. Marathon muscle damage lasts two to three weeks after you feel fine. No deficit, no workouts, light lifting.
      </div>

      <h2>Weekly shape</h2>
      <table className="table">
        <tbody>
          <tr><td>Mon</td><td>Upper A — overhead press, rows, face pulls, lateral raises, scapular control</td></tr>
          <tr><td>Tue</td><td>Quality run — threshold or intervals</td></tr>
          <tr><td>Wed</td><td>Lower — trap-bar deadlift (odd weeks) or front squat (even weeks), split squats, hamstrings, calves</td></tr>
          <tr><td>Thu</td><td>Easy run with strides</td></tr>
          <tr><td>Fri</td><td>Upper B — chin-ups, landmine press, rows, rear delts, Y-T-Ws, carries</td></tr>
          <tr><td>Sat</td><td>Long run, with marathon-pace segments from week 9</td></tr>
          <tr><td>Sun</td><td>Rest and the posture routine (optional short recovery run)</td></tr>
        </tbody>
      </table>
      <p>
        Hard days are clustered so easy days stay easy. Tuesday's quality run sits right before Wednesday's heavy legs on purpose: your legs are already fatigued, so the fatigue lands on one block of days and you go into Saturday's long run with two lighter days behind you.
      </p>

      {race && (
        <>
          <h2>{race.name}: the detour</h2>
          <div className="card">
            <h3>{RACE_PREP_PHASE.name} <span className="muted" style={{ fontWeight: 400 }}>· {RACE_PREP_PHASE.weeks} weeks ending {race.date}</span></h3>
            <p>{RACE_PREP_PHASE.goal}</p>
            <ul>
              <li><b>Running.</b> {RACE_PREP_PHASE.running}</li>
              <li><b>Lifting.</b> {RACE_PREP_PHASE.lifting}</li>
              <li><b>Nutrition.</b> {RACE_PREP_PHASE.nutrition}</li>
            </ul>
          </div>
          <div className="callout">
            {(race.distanceKm ?? 42.2) < 30
              ? 'This half sits on marathon fitness with no speed work behind it. Your marathon predicts about 1:37; a good day is 1:34–1:37. Sub-1:30 needs 4:16/km, faster than your current threshold pace, and belongs to a dedicated block next year. Race on even splits at the pace Tuesday of prep week 2 showed you can hold.'
              : 'This race sits on a short build. Expect a time near your last marathon, not under it. Run the first 30 km at or slightly slower than last time; with this preparation the race is won by not losing it early.'}
            {' '}The hybrid block restarts the day after, beginning with two recovery weeks at maintenance.
          </div>
        </>
      )}

      <h2>Phases</h2>
      {PHASES.map((p) => (
        <div key={p.key} className="card">
          <h3>{p.name} <span className="muted" style={{ fontWeight: 400 }}>· {p.weeks} weeks</span></h3>
          <p>{p.goal}</p>
          <ul>
            <li><b>Running.</b> {p.running}</li>
            <li><b>Lifting.</b> {p.lifting}</li>
            <li><b>Nutrition.</b> {p.nutrition}</li>
          </ul>
        </div>
      ))}

      <h2>Shoulders and posture</h2>
      <p>
        Runners and desk workers both drift into the same shape: rounded upper back, forward head, tight hip flexors, weak glutes and rear delts.
        The programme attacks it from three angles instead of stretching alone:
      </p>
      <ul>
        <li><b>Overhead pressing</b> (barbell press, landmine press) builds the shoulders and demands a stacked ribcage over the pelvis.</li>
        <li><b>High-volume pulling</b> (chest-supported rows, face pulls, rear-delt flys, Y-T-Ws, band pull-aparts) is roughly twice the pushing volume. Every rep is done with a pause and a squeeze — these are posture drills with load.</li>
        <li><b>Front squats, RDLs and carries</b> train the upright, braced trunk you need at 35 km of a marathon and at hour six of a desk day.</li>
      </ul>
      <p>The rest of the programme is deliberately rounded: hinge, squat, unilateral legs, hamstrings, calves and trunk. Nordic curls and calf raises are running-injury insurance and are not optional.</p>

      <h3>Daily posture routine (5 minutes, every day)</h3>
      <ul>{DAILY_POSTURE.map((p) => <li key={p}>{p}</li>)}</ul>

      <h2>How to progress the lifts</h2>
      <ul>
        <li><b>Double progression.</b> Each exercise has a rep range. When every set hits the top of the range, the app suggests adding the increment next time. If a set falls below the bottom, back off 5%.</li>
        <li><b>RPE</b> is reps in reserve turned around: RPE 8 means two clean reps left. Main lifts sit at RPE 7.5–8.5; accessories can go closer to failure.</li>
        <li><b>Deload weeks</b> (6, 10, 14) drop a set and two RPE points. Do not "make up" work in them.</li>
        <li>Chin-ups: once 4×8 bodyweight is comfortable, add load on a belt. Log added weight, not bodyweight.</li>
      </ul>

      <h2>Running paces</h2>
      {z && (
        <table className="table">
          <tbody>
            <tr><td>Easy / long</td><td className="num">{formatPaceRange(z.easy)}</td></tr>
            <tr><td>Marathon pace</td><td className="num">{formatPaceRange(z.marathon)}</td></tr>
            <tr><td>Threshold</td><td className="num">{formatPaceRange(z.threshold)}</td></tr>
            <tr><td>Intervals</td><td className="num">{formatPaceRange(z.interval)}</td></tr>
            <tr><td>Strides / reps</td><td className="num">{formatPaceRange(z.repetition)}</td></tr>
          </tbody>
        </table>
      )}
      <p>
        Derived from your marathon time with the Daniels VDOT model. In a deficit and with heavy legs from lifting, run the easy runs at the slow end. If a threshold session feels like a race, it is too fast.
      </p>

      <h2>Nutrition</h2>
      <ul>
        <li>Maintenance is estimated from Mifflin–St Jeor plus your actual training load. It is a starting guess with ±10–15% error; the scale trend is the truth. Log weight most mornings and the app nudges intake after two weeks.</li>
        <li>Protein 2.0 g/kg (~160 g). This is the single most important number while cutting.</li>
        <li>Deficit of ~400 kcal/day on normal days. None on the long-run day, and add ~60 g carbs the evening before it.</li>
        <li>Fat ≈ 0.8 g/kg; the rest is carbohydrate, and most of it belongs around Tuesday and Saturday.</li>
        <li>Alcohol and sleep debt hurt this plan more than a missed session does.</li>
      </ul>

      <h2>Week 14 tests</h2>
      <ul>
        <li>5 km time trial on Saturday. Compare to the prediction in Progress. Then enter an equivalent marathon time in Settings to recalibrate paces for the next block.</li>
        <li>Main-lift rep-outs: last working weight for as many clean reps as possible on press, deadlift, squat, chin-up. The app shows an estimated 1RM for each.</li>
        <li>Weight, waist, and a photo. Then two weeks at maintenance before deciding the next block.</li>
      </ul>

      <h2>When to deviate</h2>
      <ul>
        <li>Sick or slept under six hours: swap the quality run for easy, or skip the lift. Never both hard.</li>
        <li>Niggle that changes your stride: stop the run. Lifting can usually continue.</li>
        <li>Two consecutive lifting sessions where loads go backwards: you are under-eating. Add 200 kcal for a week.</li>
        <li>Life gets in the way: keep Tuesday, Wednesday and Saturday. Everything else is negotiable.</li>
      </ul>
    </div>
  );
}
