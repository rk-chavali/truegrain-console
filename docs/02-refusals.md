# Reading a refusal

The engine declines questions it cannot answer correctly rather than returning
a plausible wrong number. A refusal is not a failure of the request so much as
a statement about it, and it says what to do next.

## The three branches

Every refusal carries a retry class, and it is the field to branch on rather
than the message text.

| Class | Meaning | What to do |
| --- | --- | --- |
| `modify` | The question is answerable, but not as written | Change the arguments. The hint usually names what does answer it |
| `later` | Nothing about the request is wrong | Something outside it failed. The same call may work shortly |
| `never` | No version of this from this caller will succeed | Usually a denial. Say so rather than substituting a different metric |

Choosing between those is the difference between an agent that corrects itself
and one that loops on a denial forever.

## The one you will meet first

```
refused (fan_out_would_inflate): metric "order_revenue" aggregates SUM(...)
over orders, but this query repeats orders rows: order_lines is not unique on
order_id, so joining it repeats every orders row once per matching
order_lines row
```

An order contains several lines. Joining the two repeats every order row once
per line, so a sum over the order header counts the same revenue several times.
On the fixture model that question would have answered **2361.00** instead of
**885.50**, an overstatement of 167% that looks entirely plausible.

Silently returning it is the failure that kills trust in a semantic layer, so
the engine refuses and names the metrics defined at the grain where the
question *is* well defined.

## Nothing compiled

When a request is refused, no SQL exists. The engine decides between planning
and emission, so there is no statement to run, no warehouse job to cancel and
nothing to leak. Explore says so rather than leaving an empty panel for you to
interpret.
