# API health checks

The API defaults to `API_HOST=0.0.0.0` and `API_PORT=3001`. This listens on IPv4.
Use the numeric IPv4 loopback address for probes inside the API container:

```sh
wget -q -O - http://127.0.0.1:3001/health
```

For an Alpine-based API image, an instance-owned Compose service can use:

```yaml
healthcheck:
  test: ["CMD", "wget", "-q", "-O", "-", "http://127.0.0.1:3001/health"]
  interval: 30s
  timeout: 5s
  retries: 3
  start_period: 30s
```

The API image must include `wget`. Adjust the literal port if the instance sets
`API_PORT`. `/health` is public and outside the `/api` prefix. This example checks
HTTP reachability; also inspect `status` and `services.database` in the JSON when
validating database readiness. A degraded response can still have HTTP 200.

Avoid `http://localhost:3001/health` for an IPv4-only listener. On Alpine and other
systems, `localhost` can resolve first to IPv6 `::1`, causing connection refusal
even when IPv4 is healthy. Changing the application's default bind address is
unnecessary for this probe fix and can break hosts with IPv6 disabled.

`API_HOST` remains configurable. If the instance intentionally binds only to
`::1`, use `http://[::1]:3001/health` instead. A probe in a different container must
use the API service's network name and port, since loopback refers to the probe's
own container. Keep port exposure and firewall policy in the instance repository.

The isolated demo launcher already uses `127.0.0.1` for its health requests.
