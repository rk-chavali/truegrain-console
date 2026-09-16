# Grain

Grain is the level at which a fact is recorded: one row per order, one row per
order line, one row per customer per day. Almost every wrong number in
analytics comes from mixing two of them.

## Why the stack is drawn

Explore shows one plane per level your question touches, at that level's row
density. When the engine refuses a fan-out, the lower plane fills with more
marks than the one above it, which is exactly what the join does to the data.

The level names and the one that repeats both come from the engine's own
refusal rather than from a guess about your model.

## What the engine derives, and from what

Apache Ossie declares neither grain nor join cardinality. The engine derives
both from the primary key: a join is safe when its target columns are a
declared key on the target, and repeats rows otherwise.

That has a consequence worth knowing. A dataset with no `primary_key` looks
like it repeats on every join, so every sum taken across one is refused. If
the engine is refusing something you believe is safe, check the key first.

## Facts at different grains

"Revenue and marketing spend by month" asks for two facts that live at
different grains. One flat join cannot answer it. The engine aggregates each
fact separately at the shared dimension grain and joins the grouped results,
using a full outer join because a month with orders and no campaigns is a real
row, and a null-safe comparison because a null dimension value is a real group.
