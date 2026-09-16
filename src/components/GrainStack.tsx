/**
 * The isometric stack of grain levels.
 *
 * This engine reasons about grain, the level at which a fact is recorded, and
 * a fan-out is what happens when a join crosses grains and rows multiply. The
 * stack draws one plane per level a question touches, at that level's row
 * density, so the multiplication is something watched rather than read.
 *
 * The level names and the one that repeats both come from the engine's own
 * refusal, not from a guess about the model's shape.
 */

export interface StackProps {
  /** Dataset names the question touches, coarsest first. */
  levels: string[];
  /** The level the engine said repeats, if any. */
  inflating: string | null;
  /** True once something is selected, so the planes read as in use. */
  active: boolean;
}

const SLIDE = 46;

export function GrainStack({ levels, inflating, active }: StackProps) {
  const shown = levels.slice(0, 4);
  const back = ((shown.length - 1) * SLIDE) / 2;

  return (
    <section className="stack-wrap">
      <div className="stack-head">
        <h2>Grain</h2>
        <p>
          {inflating
            ? "The lower level repeats the one above it."
            : "One level per table your question touches."}
        </p>
      </div>

      <div className="scene">
        <div
          className={inflating ? "stack alarm" : "stack"}
          style={{ margin: `${-back}px 0 0 ${-back}px` }}
        >
          {shown.map((name, i) => {
            const repeats = name === inflating;
            const rows = repeats ? 36 : 12;
            return (
              <div
                key={name}
                className={"plane" + (repeats ? " inflating" : active ? " active" : "")}
                style={{
                  transform: `translate3d(${i * SLIDE}px, ${i * SLIDE}px, ${
                    (shown.length - 1 - i) * 30
                  }px)`,
                }}
              >
                <span className="name">{name}</span>
                <span className="rowcount">{rows} rows</span>
                <div className="marks">
                  {Array.from({ length: rows }, (_, r) => (
                    <i key={r} />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="legend">
        <b>
          <i style={{ background: "#4fd1c5" }} />
          one row per record
        </b>
        {inflating && (
          <b>
            <i style={{ background: "#e8a33d" }} />
            repeated by the join
          </b>
        )}
      </p>
    </section>
  );
}
