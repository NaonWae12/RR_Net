package middleware

import (
	"context"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strconv"
	"testing"
	"time"

	"github.com/go-redis/redis/v8"
	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
)

// mockRedisClient is a simple in-memory mock for Redis
type mockRedisClient struct {
	data map[string]string
	ttl  map[string]time.Duration
}

func newMockRedisClient() *mockRedisClient {
	return &mockRedisClient{
		data: make(map[string]string),
		ttl:  make(map[string]time.Duration),
	}
}

func (m *mockRedisClient) Get(ctx context.Context, key string) *redis.StringCmd {
	val, ok := m.data[key]
	cmd := redis.NewStringCmd(ctx, "get", key)
	if !ok {
		cmd.SetErr(redis.Nil)
	} else {
		cmd.SetVal(val)
	}
	return cmd
}

func (m *mockRedisClient) Incr(ctx context.Context, key string) *redis.IntCmd {
	current := 0
	if raw, ok := m.data[key]; ok {
		if parsed, err := strconv.Atoi(raw); err == nil {
			current = parsed
		}
	}
	current++
	m.data[key] = strconv.Itoa(current)
	cmd := redis.NewIntCmd(ctx, "incr", key)
	cmd.SetVal(int64(current))
	return cmd
}

func (m *mockRedisClient) Expire(ctx context.Context, key string, expiration time.Duration) *redis.BoolCmd {
	m.ttl[key] = expiration
	cmd := redis.NewBoolCmd(ctx, "expire", key, expiration)
	cmd.SetVal(true)
	return cmd
}

func (m *mockRedisClient) TTL(ctx context.Context, key string) *redis.DurationCmd {
	ttlVal, ok := m.ttl[key]
	cmd := redis.NewDurationCmd(ctx, 0, "ttl", key)
	if !ok {
		cmd.SetVal(-1 * time.Second)
	} else {
		cmd.SetVal(ttlVal)
	}
	return cmd
}

func (m *mockRedisClient) Pipeline() redis.Pipeliner {
	return &mockPipeline{client: m}
}

type mockPipeline struct {
	client *mockRedisClient
	cmds   []redis.Cmder
}

func (m *mockPipeline) Incr(ctx context.Context, key string) *redis.IntCmd {
	cmd := m.client.Incr(ctx, key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Expire(ctx context.Context, key string, expiration time.Duration) *redis.BoolCmd {
	cmd := m.client.Expire(ctx, key, expiration)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ExpireAt(ctx context.Context, key string, tm time.Time) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "expireat", key, tm.Unix())
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GeoAdd(ctx context.Context, key string, geoLocation ...*redis.GeoLocation) *redis.IntCmd {
	args := append([]interface{}{"geoadd", key}, geoLocationToArgs(geoLocation)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GeoPos(ctx context.Context, key string, members ...string) *redis.GeoPosCmd {
	args := append([]interface{}{"geopos", key}, interfaceSlice(members)...)
	cmd := redis.NewGeoPosCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GeoRadius(ctx context.Context, key string, longitude, latitude float64, query *redis.GeoRadiusQuery) *redis.GeoLocationCmd {
	args := []interface{}{"georadius", key, longitude, latitude}
	cmd := redis.NewGeoLocationCmd(ctx, query, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GeoRadiusByMember(ctx context.Context, key, member string, query *redis.GeoRadiusQuery) *redis.GeoLocationCmd {
	args := []interface{}{"georadiusbymember", key, member}
	cmd := redis.NewGeoLocationCmd(ctx, query, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GeoDist(ctx context.Context, key string, member1, member2, unit string) *redis.FloatCmd {
	args := []interface{}{"geodist", key, member1, member2}
	if unit != "" {
		args = append(args, unit)
	}
	cmd := redis.NewFloatCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GeoHash(ctx context.Context, key string, members ...string) *redis.StringSliceCmd {
	args := append([]interface{}{"geohash", key}, interfaceSlice(members)...)
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GeoSearch(ctx context.Context, key string, q *redis.GeoSearchQuery) *redis.StringSliceCmd {
	cmd := redis.NewStringSliceCmd(ctx, "geosearch", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GeoSearchLocation(ctx context.Context, key string, q *redis.GeoSearchLocationQuery) *redis.GeoSearchLocationCmd {
	cmd := redis.NewGeoSearchLocationCmd(ctx, q, "geosearch", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GeoSearchStore(ctx context.Context, key, store string, q *redis.GeoSearchStoreQuery) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "geosearchstore", store, key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GeoRadiusByMemberStore(ctx context.Context, key, member string, query *redis.GeoRadiusQuery) *redis.IntCmd {
	args := []interface{}{"georadiusbymember", key, member}
	if query != nil {
		args = append(args, query.Radius)
		if query.Unit != "" {
			args = append(args, query.Unit)
		}
		if query.WithDist {
			args = append(args, "withdist")
		}
		if query.WithCoord {
			args = append(args, "withcoord")
		}
		if query.Count > 0 {
			args = append(args, "count", query.Count)
		}
		if query.Sort != "" {
			args = append(args, query.Sort)
		}
	}
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GeoRadiusStore(ctx context.Context, key string, longitude, latitude float64, query *redis.GeoRadiusQuery) *redis.IntCmd {
	args := []interface{}{"georadius", key, longitude, latitude}
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

// Helper to convert GeoLocation slice to args
func geoLocationToArgs(locations []*redis.GeoLocation) []interface{} {
	var args []interface{}
	for _, loc := range locations {
		args = append(args, loc.Longitude, loc.Latitude, loc.Name)
	}
	return args
}

func (m *mockPipeline) Exec(ctx context.Context) ([]redis.Cmder, error) {
	return m.cmds, nil
}

func (m *mockPipeline) Discard() error {
	m.cmds = nil
	return nil
}

func (m *mockPipeline) Do(ctx context.Context, args ...interface{}) *redis.Cmd {
	cmd := redis.NewCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Echo(ctx context.Context, message interface{}) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "echo", message)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Ping(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "ping")
	cmd.SetVal("PONG")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Select(ctx context.Context, index int) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "select", index)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SwapDB(ctx context.Context, index1, index2 int) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "swapdb", index1, index2)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) TTL(ctx context.Context, key string) *redis.DurationCmd {
	return m.client.TTL(ctx, key)
}

func (m *mockPipeline) Eval(ctx context.Context, script string, keys []string, args ...interface{}) *redis.Cmd {
	cmdArgs := append([]interface{}{"eval", script, len(keys)}, interfaceSlice(keys)...)
	cmdArgs = append(cmdArgs, args...)
	cmd := redis.NewCmd(ctx, cmdArgs...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) EvalSha(ctx context.Context, sha1 string, keys []string, args ...interface{}) *redis.Cmd {
	cmdArgs := append([]interface{}{"evalsha", sha1, len(keys)}, interfaceSlice(keys)...)
	cmdArgs = append(cmdArgs, args...)
	cmd := redis.NewCmd(ctx, cmdArgs...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ScriptExists(ctx context.Context, hashes ...string) *redis.BoolSliceCmd {
	args := append([]interface{}{"script", "exists"}, interfaceSlice(hashes)...)
	cmd := redis.NewBoolSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ScriptFlush(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "script", "flush")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ScriptKill(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "script", "kill")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ScriptLoad(ctx context.Context, script string) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "script", "load", script)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Close() error {
	return nil
}

func (m *mockPipeline) Auth(ctx context.Context, password string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "auth", password)
	cmd.SetVal("OK")
	return cmd
}

func (m *mockPipeline) AuthACL(ctx context.Context, username, password string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "auth", username, password)
	cmd.SetVal("OK")
	return cmd
}

func (m *mockPipeline) BLMove(ctx context.Context, source, destination, srcpos, destpos string, timeout time.Duration) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "blmove", source, destination, srcpos, destpos, timeout)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) BLPop(ctx context.Context, timeout time.Duration, keys ...string) *redis.StringSliceCmd {
	args := make([]interface{}, len(keys)+1)
	for i, k := range keys {
		args[i] = k
	}
	args[len(keys)] = timeout.Seconds()
	cmd := redis.NewStringSliceCmd(ctx, append([]interface{}{"blpop"}, args...)...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) BRPop(ctx context.Context, timeout time.Duration, keys ...string) *redis.StringSliceCmd {
	args := make([]interface{}, len(keys)+1)
	for i, k := range keys {
		args[i] = k
	}
	args[len(keys)] = timeout.Seconds()
	cmd := redis.NewStringSliceCmd(ctx, append([]interface{}{"brpop"}, args...)...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

// Add stub implementations for other common redis.Pipeliner methods
// These are not used by the rate limiter but required by the interface
func (m *mockPipeline) BRPopLPush(ctx context.Context, source, destination string, timeout time.Duration) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "brpoplpush", source, destination, timeout.Seconds())
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LIndex(ctx context.Context, key string, index int64) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "lindex", key, index)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LInsert(ctx context.Context, key, op string, pivot, value interface{}) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "linsert", key, op, pivot, value)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LInsertBefore(ctx context.Context, key string, pivot, value interface{}) *redis.IntCmd {
	return m.LInsert(ctx, key, "before", pivot, value)
}

func (m *mockPipeline) LInsertAfter(ctx context.Context, key string, pivot, value interface{}) *redis.IntCmd {
	return m.LInsert(ctx, key, "after", pivot, value)
}

func (m *mockPipeline) LLen(ctx context.Context, key string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "llen", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LPop(ctx context.Context, key string) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "lpop", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LPopCount(ctx context.Context, key string, count int) *redis.StringSliceCmd {
	cmd := redis.NewStringSliceCmd(ctx, "lpop", key, count)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) RPopCount(ctx context.Context, key string, count int) *redis.StringSliceCmd {
	cmd := redis.NewStringSliceCmd(ctx, "rpop", key, count)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LPush(ctx context.Context, key string, values ...interface{}) *redis.IntCmd {
	args := append([]interface{}{"lpush", key}, values...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LPushX(ctx context.Context, key string, values ...interface{}) *redis.IntCmd {
	args := append([]interface{}{"lpushx", key}, values...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LRange(ctx context.Context, key string, start, stop int64) *redis.StringSliceCmd {
	cmd := redis.NewStringSliceCmd(ctx, "lrange", key, start, stop)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LRem(ctx context.Context, key string, count int64, value interface{}) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "lrem", key, count, value)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LSet(ctx context.Context, key string, index int64, value interface{}) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "lset", key, index, value)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LTrim(ctx context.Context, key string, start, stop int64) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "ltrim", key, start, stop)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LMove(ctx context.Context, source, destination, srcpos, destpos string) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "lmove", source, destination, srcpos, destpos)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LPos(ctx context.Context, key string, value string, args redis.LPosArgs) *redis.IntCmd {
	cmdArgs := []interface{}{"lpos", key, value}
	if args.Rank != 0 {
		cmdArgs = append(cmdArgs, "rank", args.Rank)
	}
	if args.MaxLen != 0 {
		cmdArgs = append(cmdArgs, "maxlen", args.MaxLen)
	}
	cmd := redis.NewIntCmd(ctx, cmdArgs...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LPosCount(ctx context.Context, key string, value string, count int64, args redis.LPosArgs) *redis.IntSliceCmd {
	cmdArgs := []interface{}{"lpos", key, value, "count", count}
	if args.Rank != 0 {
		cmdArgs = append(cmdArgs, "rank", args.Rank)
	}
	if args.MaxLen != 0 {
		cmdArgs = append(cmdArgs, "maxlen", args.MaxLen)
	}
	cmd := redis.NewIntSliceCmd(ctx, cmdArgs...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Len() int {
	return len(m.cmds)
}

func (m *mockPipeline) Pipeline() redis.Pipeliner {
	return m
}

func (m *mockPipeline) TxPipeline() redis.Pipeliner {
	return m
}

func (m *mockPipeline) Pipelined(ctx context.Context, fn func(redis.Pipeliner) error) ([]redis.Cmder, error) {
	if err := fn(m); err != nil {
		return nil, err
	}
	return m.Exec(ctx)
}

func (m *mockPipeline) TxPipelined(ctx context.Context, fn func(redis.Pipeliner) error) ([]redis.Cmder, error) {
	if err := fn(m); err != nil {
		return nil, err
	}
	return m.Exec(ctx)
}

// Stream operations - stub implementations
func (m *mockPipeline) XAck(ctx context.Context, stream, group string, ids ...string) *redis.IntCmd {
	args := append([]interface{}{"xack", stream, group}, interfaceSlice(ids)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XAdd(ctx context.Context, a *redis.XAddArgs) *redis.StringCmd {
	args := []interface{}{"xadd", a.Stream}
	if a.MaxLen > 0 {
		args = append(args, "maxlen")
		if a.Approx {
			args = append(args, "~")
		}
		args = append(args, a.MaxLen)
	}
	if a.MinID != "" {
		args = append(args, "minid")
		if a.Approx {
			args = append(args, "~")
		}
		args = append(args, a.MinID)
	}
	if a.Limit > 0 {
		args = append(args, "limit", a.Limit)
	}
	if a.NoMkStream {
		args = append(args, "nomkstream")
	}
	if a.ID != "" {
		args = append(args, a.ID)
	} else {
		args = append(args, "*")
	}
	if a.Values != nil {
		if valuesMap, ok := a.Values.(map[string]interface{}); ok {
			for k, v := range valuesMap {
				args = append(args, k, v)
			}
		}
	}
	cmd := redis.NewStringCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XDel(ctx context.Context, stream string, ids ...string) *redis.IntCmd {
	args := append([]interface{}{"xdel", stream}, interfaceSlice(ids)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XGroupCreate(ctx context.Context, stream, group, start string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "xgroup", "create", stream, group, start)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XGroupCreateMkStream(ctx context.Context, stream, group, start string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "xgroup", "create", stream, group, start, "mkstream")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XGroupSetID(ctx context.Context, stream, group, start string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "xgroup", "setid", stream, group, start)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XGroupDestroy(ctx context.Context, stream, group string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "xgroup", "destroy", stream, group)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XGroupDelConsumer(ctx context.Context, stream, group, consumer string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "xgroup", "delconsumer", stream, group, consumer)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XGroupCreateConsumer(ctx context.Context, stream, group, consumer string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "xgroup", "createconsumer", stream, group, consumer)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XLen(ctx context.Context, stream string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "xlen", stream)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XPending(ctx context.Context, stream, group string) *redis.XPendingCmd {
	cmd := redis.NewXPendingCmd(ctx, "xpending", stream, group)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XPendingExt(ctx context.Context, a *redis.XPendingExtArgs) *redis.XPendingExtCmd {
	args := []interface{}{"xpending", a.Stream, a.Group}
	if a.Start != "" || a.End != "" || a.Count > 0 {
		args = append(args, a.Start, a.End, a.Count)
		if a.Consumer != "" {
			args = append(args, a.Consumer)
		}
	}
	cmd := redis.NewXPendingExtCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XRange(ctx context.Context, stream, start, stop string) *redis.XMessageSliceCmd {
	cmd := redis.NewXMessageSliceCmd(ctx, "xrange", stream, start, stop)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XRangeN(ctx context.Context, stream, start, stop string, count int64) *redis.XMessageSliceCmd {
	cmd := redis.NewXMessageSliceCmd(ctx, "xrange", stream, start, stop, "count", count)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XRevRange(ctx context.Context, stream, start, stop string) *redis.XMessageSliceCmd {
	cmd := redis.NewXMessageSliceCmd(ctx, "xrevrange", stream, start, stop)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XRevRangeN(ctx context.Context, stream, start, stop string, count int64) *redis.XMessageSliceCmd {
	cmd := redis.NewXMessageSliceCmd(ctx, "xrevrange", stream, start, stop, "count", count)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XRead(ctx context.Context, a *redis.XReadArgs) *redis.XStreamSliceCmd {
	args := []interface{}{"xread"}
	if a.Count > 0 {
		args = append(args, "count", a.Count)
	}
	if a.Block > 0 {
		args = append(args, "block", int64(a.Block.Milliseconds()))
	}
	if len(a.Streams) > 0 {
		args = append(args, "streams")
		for _, s := range a.Streams {
			args = append(args, s)
		}
	}
	cmd := redis.NewXStreamSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XReadStreams(ctx context.Context, streams ...string) *redis.XStreamSliceCmd {
	args := append([]interface{}{"xread", "streams"}, interfaceSlice(streams)...)
	cmd := redis.NewXStreamSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XReadGroup(ctx context.Context, a *redis.XReadGroupArgs) *redis.XStreamSliceCmd {
	args := []interface{}{"xreadgroup", "group", a.Group, a.Consumer}
	if a.Count > 0 {
		args = append(args, "count", a.Count)
	}
	if a.Block > 0 {
		args = append(args, "block", int64(a.Block.Milliseconds()))
	}
	if a.NoAck {
		args = append(args, "noack")
	}
	if len(a.Streams) > 0 {
		args = append(args, "streams")
		for _, s := range a.Streams {
			args = append(args, s)
		}
	}
	cmd := redis.NewXStreamSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XTrim(ctx context.Context, key string, maxLen int64) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "xtrim", key, "maxlen", maxLen)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XTrimApprox(ctx context.Context, key string, maxLen int64) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "xtrim", key, "maxlen", "~", maxLen)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XTrimMinID(ctx context.Context, key string, minID string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "xtrim", key, "minid", minID)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XTrimMinIDApprox(ctx context.Context, key string, minID string, limit int64) *redis.IntCmd {
	args := []interface{}{"xtrim", key, "minid", "~", minID}
	if limit > 0 {
		args = append(args, "limit", limit)
	}
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XTrimMaxLen(ctx context.Context, key string, maxLen int64) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "xtrim", key, "maxlen", maxLen)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XTrimMaxLenApprox(ctx context.Context, key string, maxLen, limit int64) *redis.IntCmd {
	args := []interface{}{"xtrim", key, "maxlen", "~", maxLen}
	if limit > 0 {
		args = append(args, "limit", limit)
	}
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XInfoGroups(ctx context.Context, key string) *redis.XInfoGroupsCmd {
	cmd := redis.NewXInfoGroupsCmd(ctx, key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XInfoStream(ctx context.Context, key string) *redis.XInfoStreamCmd {
	cmd := redis.NewXInfoStreamCmd(ctx, key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XInfoStreamFull(ctx context.Context, key string, count int) *redis.XInfoStreamFullCmd {
	args := []interface{}{"xinfo", "stream", key, "full"}
	if count > 0 {
		args = append(args, "count", count)
	}
	cmd := redis.NewXInfoStreamFullCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XInfoConsumers(ctx context.Context, key string, group string) *redis.XInfoConsumersCmd {
	cmd := redis.NewXInfoConsumersCmd(ctx, key, group)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XClaim(ctx context.Context, a *redis.XClaimArgs) *redis.XMessageSliceCmd {
	args := []interface{}{"xclaim", a.Stream, a.Group, a.Consumer, int64(a.MinIdle.Milliseconds())}
	args = append(args, interfaceSlice(a.Messages)...)
	cmd := redis.NewXMessageSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XClaimJustID(ctx context.Context, a *redis.XClaimArgs) *redis.StringSliceCmd {
	args := []interface{}{"xclaim", a.Stream, a.Group, a.Consumer, int64(a.MinIdle.Milliseconds()), "justid"}
	args = append(args, interfaceSlice(a.Messages)...)
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XAutoClaim(ctx context.Context, a *redis.XAutoClaimArgs) *redis.XAutoClaimCmd {
	args := []interface{}{"xautoclaim", a.Stream, a.Group, a.Consumer, int64(a.MinIdle.Milliseconds())}
	if a.Start != "" {
		args = append(args, a.Start)
	}
	if a.Count > 0 {
		args = append(args, "count", a.Count)
	}
	cmd := redis.NewXAutoClaimCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) XAutoClaimJustID(ctx context.Context, a *redis.XAutoClaimArgs) *redis.XAutoClaimJustIDCmd {
	args := []interface{}{"xautoclaim", a.Stream, a.Group, a.Consumer, int64(a.MinIdle.Milliseconds()), "justid"}
	if a.Start != "" {
		args = append(args, a.Start)
	}
	if a.Count > 0 {
		args = append(args, "count", a.Count)
	}
	cmd := redis.NewXAutoClaimJustIDCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Process(ctx context.Context, cmd redis.Cmder) error {
	m.cmds = append(m.cmds, cmd)
	return nil
}

func (m *mockPipeline) Quit(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "quit")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

// Pub/Sub operations
func (m *mockPipeline) PubSubChannels(ctx context.Context, pattern string) *redis.StringSliceCmd {
	args := []interface{}{"pubsub", "channels"}
	if pattern != "" {
		args = append(args, pattern)
	}
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) PubSubNumSub(ctx context.Context, channels ...string) *redis.StringIntMapCmd {
	args := append([]interface{}{"pubsub", "numsub"}, interfaceSlice(channels)...)
	cmd := redis.NewStringIntMapCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) PubSubNumPat(ctx context.Context) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "pubsub", "numpat")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Publish(ctx context.Context, channel string, message interface{}) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "publish", channel, message)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

// Sorted set operations
func (m *mockPipeline) ZAdd(ctx context.Context, key string, members ...*redis.Z) *redis.IntCmd {
	args := append([]interface{}{"zadd", key}, zMembersToArgs(members)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZAddNX(ctx context.Context, key string, members ...*redis.Z) *redis.IntCmd {
	args := append([]interface{}{"zadd", key, "nx"}, zMembersToArgs(members)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZAddXX(ctx context.Context, key string, members ...*redis.Z) *redis.IntCmd {
	args := append([]interface{}{"zadd", key, "xx"}, zMembersToArgs(members)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZAddNXCh(ctx context.Context, key string, members ...*redis.Z) *redis.IntCmd {
	args := append([]interface{}{"zadd", key, "nx", "ch"}, zMembersToArgs(members)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZAddXXCh(ctx context.Context, key string, members ...*redis.Z) *redis.IntCmd {
	args := append([]interface{}{"zadd", key, "xx", "ch"}, zMembersToArgs(members)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZAddCh(ctx context.Context, key string, members ...*redis.Z) *redis.IntCmd {
	args := append([]interface{}{"zadd", key, "ch"}, zMembersToArgs(members)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZAddArgs(ctx context.Context, key string, args redis.ZAddArgs) *redis.IntCmd {
	cmdArgs := []interface{}{"zadd", key}
	if args.NX {
		cmdArgs = append(cmdArgs, "nx")
	}
	if args.XX {
		cmdArgs = append(cmdArgs, "xx")
	}
	if args.GT {
		cmdArgs = append(cmdArgs, "gt")
	}
	if args.LT {
		cmdArgs = append(cmdArgs, "lt")
	}
	if args.Ch {
		cmdArgs = append(cmdArgs, "ch")
	}
	for _, m := range args.Members {
		cmdArgs = append(cmdArgs, m.Score, m.Member)
	}
	cmd := redis.NewIntCmd(ctx, cmdArgs...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZAddArgsIncr(ctx context.Context, key string, args redis.ZAddArgs) *redis.FloatCmd {
	cmdArgs := []interface{}{"zadd", key, "incr"}
	if args.NX {
		cmdArgs = append(cmdArgs, "nx")
	}
	if args.XX {
		cmdArgs = append(cmdArgs, "xx")
	}
	if args.GT {
		cmdArgs = append(cmdArgs, "gt")
	}
	if args.LT {
		cmdArgs = append(cmdArgs, "lt")
	}
	if len(args.Members) > 0 {
		cmdArgs = append(cmdArgs, args.Members[0].Score, args.Members[0].Member)
	}
	cmd := redis.NewFloatCmd(ctx, cmdArgs...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZIncr(ctx context.Context, key string, member *redis.Z) *redis.FloatCmd {
	cmd := redis.NewFloatCmd(ctx, "zincr", key, member.Score, member.Member)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZIncrNX(ctx context.Context, key string, member *redis.Z) *redis.FloatCmd {
	cmd := redis.NewFloatCmd(ctx, "zincr", key, "nx", member.Score, member.Member)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZIncrXX(ctx context.Context, key string, member *redis.Z) *redis.FloatCmd {
	cmd := redis.NewFloatCmd(ctx, "zincr", key, "xx", member.Score, member.Member)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZCard(ctx context.Context, key string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "zcard", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZCount(ctx context.Context, key, min, max string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "zcount", key, min, max)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZLexCount(ctx context.Context, key, min, max string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "zlexcount", key, min, max)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZIncrBy(ctx context.Context, key string, increment float64, member string) *redis.FloatCmd {
	cmd := redis.NewFloatCmd(ctx, "zincrby", key, increment, member)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZInterStore(ctx context.Context, destination string, store *redis.ZStore) *redis.IntCmd {
	args := []interface{}{"zinterstore", destination, len(store.Keys)}
	args = append(args, interfaceSlice(store.Keys)...)
	if len(store.Weights) > 0 {
		args = append(args, "weights")
		args = append(args, interfaceSlice(store.Weights)...)
	}
	if store.Aggregate != "" {
		args = append(args, "aggregate", store.Aggregate)
	}
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZPopMax(ctx context.Context, key string, count ...int64) *redis.ZSliceCmd {
	args := []interface{}{"zpopmax", key}
	if len(count) > 0 {
		args = append(args, count[0])
	}
	cmd := redis.NewZSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZPopMin(ctx context.Context, key string, count ...int64) *redis.ZSliceCmd {
	args := []interface{}{"zpopmin", key}
	if len(count) > 0 {
		args = append(args, count[0])
	}
	cmd := redis.NewZSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRange(ctx context.Context, key string, start, stop int64) *redis.StringSliceCmd {
	cmd := redis.NewStringSliceCmd(ctx, "zrange", key, start, stop)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRangeWithScores(ctx context.Context, key string, start, stop int64) *redis.ZSliceCmd {
	cmd := redis.NewZSliceCmd(ctx, "zrange", key, start, stop, "withscores")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRangeArgs(ctx context.Context, z redis.ZRangeArgs) *redis.StringSliceCmd {
	args := []interface{}{"zrange", z.Key}
	if z.ByScore {
		args = append(args, "byscore")
	}
	if z.ByLex {
		args = append(args, "bylex")
	}
	if z.Rev {
		args = append(args, "rev")
	}
	if z.Offset > 0 || z.Count > 0 {
		args = append(args, "limit", z.Offset, z.Count)
	}
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRangeArgsWithScores(ctx context.Context, z redis.ZRangeArgs) *redis.ZSliceCmd {
	args := []interface{}{"zrange", z.Key}
	if z.ByScore {
		args = append(args, "byscore")
	}
	if z.ByLex {
		args = append(args, "bylex")
	}
	if z.Rev {
		args = append(args, "rev")
	}
	if z.Offset > 0 || z.Count > 0 {
		args = append(args, "limit", z.Offset, z.Count)
	}
	args = append(args, "withscores")
	cmd := redis.NewZSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRangeStore(ctx context.Context, dest string, z redis.ZRangeArgs) *redis.IntCmd {
	args := []interface{}{"zrangestore", dest, z.Key}
	if z.ByScore {
		args = append(args, "byscore")
	}
	if z.ByLex {
		args = append(args, "bylex")
	}
	if z.Rev {
		args = append(args, "rev")
	}
	if z.Offset > 0 || z.Count > 0 {
		args = append(args, "limit", z.Offset, z.Count)
	}
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRangeByScore(ctx context.Context, key string, opt *redis.ZRangeBy) *redis.StringSliceCmd {
	args := []interface{}{"zrangebyscore", key}
	if opt != nil {
		if opt.Min != "" {
			args = append(args, opt.Min)
		}
		if opt.Max != "" {
			args = append(args, opt.Max)
		}
		if opt.Offset > 0 || opt.Count > 0 {
			args = append(args, "limit", opt.Offset, opt.Count)
		}
	}
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRangeByLex(ctx context.Context, key string, opt *redis.ZRangeBy) *redis.StringSliceCmd {
	args := []interface{}{"zrangebylex", key}
	if opt != nil {
		if opt.Min != "" {
			args = append(args, opt.Min)
		}
		if opt.Max != "" {
			args = append(args, opt.Max)
		}
		if opt.Offset > 0 || opt.Count > 0 {
			args = append(args, "limit", opt.Offset, opt.Count)
		}
	}
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRangeByScoreWithScores(ctx context.Context, key string, opt *redis.ZRangeBy) *redis.ZSliceCmd {
	args := []interface{}{"zrangebyscore", key}
	if opt != nil {
		if opt.Min != "" {
			args = append(args, opt.Min)
		}
		if opt.Max != "" {
			args = append(args, opt.Max)
		}
		if opt.Offset > 0 || opt.Count > 0 {
			args = append(args, "limit", opt.Offset, opt.Count)
		}
	}
	args = append(args, "withscores")
	cmd := redis.NewZSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRank(ctx context.Context, key, member string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "zrank", key, member)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRem(ctx context.Context, key string, members ...interface{}) *redis.IntCmd {
	args := append([]interface{}{"zrem", key}, members...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRemRangeByRank(ctx context.Context, key string, start, stop int64) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "zremrangebyrank", key, start, stop)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRemRangeByScore(ctx context.Context, key, min, max string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "zremrangebyscore", key, min, max)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRemRangeByLex(ctx context.Context, key, min, max string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "zremrangebylex", key, min, max)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRevRange(ctx context.Context, key string, start, stop int64) *redis.StringSliceCmd {
	cmd := redis.NewStringSliceCmd(ctx, "zrevrange", key, start, stop)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRevRangeWithScores(ctx context.Context, key string, start, stop int64) *redis.ZSliceCmd {
	cmd := redis.NewZSliceCmd(ctx, "zrevrange", key, start, stop, "withscores")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRevRangeByScore(ctx context.Context, key string, opt *redis.ZRangeBy) *redis.StringSliceCmd {
	args := []interface{}{"zrevrangebyscore", key}
	if opt != nil {
		if opt.Max != "" {
			args = append(args, opt.Max)
		}
		if opt.Min != "" {
			args = append(args, opt.Min)
		}
		if opt.Offset > 0 || opt.Count > 0 {
			args = append(args, "limit", opt.Offset, opt.Count)
		}
	}
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRevRangeByScoreWithScores(ctx context.Context, key string, opt *redis.ZRangeBy) *redis.ZSliceCmd {
	args := []interface{}{"zrevrangebyscore", key}
	if opt != nil {
		if opt.Max != "" {
			args = append(args, opt.Max)
		}
		if opt.Min != "" {
			args = append(args, opt.Min)
		}
		if opt.Offset > 0 || opt.Count > 0 {
			args = append(args, "limit", opt.Offset, opt.Count)
		}
	}
	args = append(args, "withscores")
	cmd := redis.NewZSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRevRangeByLex(ctx context.Context, key string, opt *redis.ZRangeBy) *redis.StringSliceCmd {
	args := []interface{}{"zrevrangebylex", key}
	if opt != nil {
		if opt.Max != "" {
			args = append(args, opt.Max)
		}
		if opt.Min != "" {
			args = append(args, opt.Min)
		}
		if opt.Offset > 0 || opt.Count > 0 {
			args = append(args, "limit", opt.Offset, opt.Count)
		}
	}
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRevRank(ctx context.Context, key, member string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "zrevrank", key, member)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZScore(ctx context.Context, key, member string) *redis.FloatCmd {
	cmd := redis.NewFloatCmd(ctx, "zscore", key, member)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZUnionStore(ctx context.Context, dest string, store *redis.ZStore) *redis.IntCmd {
	args := []interface{}{"zunionstore", dest, len(store.Keys)}
	args = append(args, interfaceSlice(store.Keys)...)
	if len(store.Weights) > 0 {
		args = append(args, "weights")
		args = append(args, interfaceSlice(store.Weights)...)
	}
	if store.Aggregate != "" {
		args = append(args, "aggregate", store.Aggregate)
	}
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRandMember(ctx context.Context, key string, count int, withScores bool) *redis.StringSliceCmd {
	args := []interface{}{"zrandmember", key, count}
	if withScores {
		args = append(args, "withscores")
	}
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZRandMemberWithScores(ctx context.Context, key string, count int) *redis.ZSliceCmd {
	cmd := redis.NewZSliceCmd(ctx, "zrandmember", key, count, "withscores")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZDiff(ctx context.Context, keys ...string) *redis.StringSliceCmd {
	args := append([]interface{}{"zdiff", len(keys)}, interfaceSlice(keys)...)
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZDiffWithScores(ctx context.Context, keys ...string) *redis.ZSliceCmd {
	args := append([]interface{}{"zdiff", len(keys)}, interfaceSlice(keys)...)
	args = append(args, "withscores")
	cmd := redis.NewZSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZDiffStore(ctx context.Context, destination string, keys ...string) *redis.IntCmd {
	args := append([]interface{}{"zdiffstore", destination, len(keys)}, interfaceSlice(keys)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZInter(ctx context.Context, store *redis.ZStore) *redis.StringSliceCmd {
	args := []interface{}{"zinter", len(store.Keys)}
	args = append(args, interfaceSlice(store.Keys)...)
	if len(store.Weights) > 0 {
		args = append(args, "weights")
		args = append(args, interfaceSlice(store.Weights)...)
	}
	if store.Aggregate != "" {
		args = append(args, "aggregate", store.Aggregate)
	}
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZInterWithScores(ctx context.Context, store *redis.ZStore) *redis.ZSliceCmd {
	args := []interface{}{"zinter", len(store.Keys)}
	args = append(args, interfaceSlice(store.Keys)...)
	if len(store.Weights) > 0 {
		args = append(args, "weights")
		args = append(args, interfaceSlice(store.Weights)...)
	}
	if store.Aggregate != "" {
		args = append(args, "aggregate", store.Aggregate)
	}
	args = append(args, "withscores")
	cmd := redis.NewZSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZUnion(ctx context.Context, store redis.ZStore) *redis.StringSliceCmd {
	args := []interface{}{"zunion", len(store.Keys)}
	args = append(args, interfaceSlice(store.Keys)...)
	if len(store.Weights) > 0 {
		args = append(args, "weights")
		args = append(args, interfaceSlice(store.Weights)...)
	}
	if store.Aggregate != "" {
		args = append(args, "aggregate", store.Aggregate)
	}
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZUnionWithScores(ctx context.Context, store redis.ZStore) *redis.ZSliceCmd {
	args := []interface{}{"zunion", len(store.Keys)}
	args = append(args, interfaceSlice(store.Keys)...)
	if len(store.Weights) > 0 {
		args = append(args, "weights")
		args = append(args, interfaceSlice(store.Weights)...)
	}
	if store.Aggregate != "" {
		args = append(args, "aggregate", store.Aggregate)
	}
	args = append(args, "withscores")
	cmd := redis.NewZSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZMScore(ctx context.Context, key string, members ...string) *redis.FloatSliceCmd {
	args := append([]interface{}{"zmscore", key}, interfaceSlice(members)...)
	cmd := redis.NewFloatSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ZScan(ctx context.Context, key string, cursor uint64, match string, count int64) *redis.ScanCmd {
	var cmd redis.ScanCmd
	cmd.SetVal([]string{}, 0)
	m.cmds = append(m.cmds, &cmd)
	return &cmd
}

// Helper functions
func zMembersToArgs(members []*redis.Z) []interface{} {
	var args []interface{}
	for _, m := range members {
		args = append(args, m.Score, m.Member)
	}
	return args
}

// HyperLogLog operations
func (m *mockPipeline) PFAdd(ctx context.Context, key string, els ...interface{}) *redis.IntCmd {
	args := append([]interface{}{"pfadd", key}, els...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) PFCount(ctx context.Context, keys ...string) *redis.IntCmd {
	args := append([]interface{}{"pfcount"}, interfaceSlice(keys)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) PFMerge(ctx context.Context, dest string, keys ...string) *redis.StatusCmd {
	args := append([]interface{}{"pfmerge", dest}, interfaceSlice(keys)...)
	cmd := redis.NewStatusCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

// Set operations
func (m *mockPipeline) SAdd(ctx context.Context, key string, members ...interface{}) *redis.IntCmd {
	args := append([]interface{}{"sadd", key}, members...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SCard(ctx context.Context, key string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "scard", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SDiff(ctx context.Context, keys ...string) *redis.StringSliceCmd {
	args := append([]interface{}{"sdiff"}, interfaceSlice(keys)...)
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SDiffStore(ctx context.Context, destination string, keys ...string) *redis.IntCmd {
	args := append([]interface{}{"sdiffstore", destination}, interfaceSlice(keys)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SInter(ctx context.Context, keys ...string) *redis.StringSliceCmd {
	args := append([]interface{}{"sinter"}, interfaceSlice(keys)...)
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SInterStore(ctx context.Context, destination string, keys ...string) *redis.IntCmd {
	args := append([]interface{}{"sinterstore", destination}, interfaceSlice(keys)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SIsMember(ctx context.Context, key string, member interface{}) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "sismember", key, member)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SMIsMember(ctx context.Context, key string, members ...interface{}) *redis.BoolSliceCmd {
	args := append([]interface{}{"smismember", key}, members...)
	cmd := redis.NewBoolSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SMembers(ctx context.Context, key string) *redis.StringSliceCmd {
	cmd := redis.NewStringSliceCmd(ctx, "smembers", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SMembersMap(ctx context.Context, key string) *redis.StringStructMapCmd {
	cmd := redis.NewStringStructMapCmd(ctx, "smembers", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SMove(ctx context.Context, source, destination string, member interface{}) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "smove", source, destination, member)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SPop(ctx context.Context, key string) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "spop", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SPopN(ctx context.Context, key string, count int64) *redis.StringSliceCmd {
	cmd := redis.NewStringSliceCmd(ctx, "spop", key, count)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SRandMember(ctx context.Context, key string) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "srandmember", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SRandMemberN(ctx context.Context, key string, count int64) *redis.StringSliceCmd {
	cmd := redis.NewStringSliceCmd(ctx, "srandmember", key, count)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SRem(ctx context.Context, key string, members ...interface{}) *redis.IntCmd {
	args := append([]interface{}{"srem", key}, members...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SUnion(ctx context.Context, keys ...string) *redis.StringSliceCmd {
	args := append([]interface{}{"sunion"}, interfaceSlice(keys)...)
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SUnionStore(ctx context.Context, destination string, keys ...string) *redis.IntCmd {
	args := append([]interface{}{"sunionstore", destination}, interfaceSlice(keys)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SScan(ctx context.Context, key string, cursor uint64, match string, count int64) *redis.ScanCmd {
	var cmd redis.ScanCmd
	cmd.SetVal([]string{}, 0)
	m.cmds = append(m.cmds, &cmd)
	return &cmd
}

func (m *mockPipeline) RPop(ctx context.Context, key string) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "rpop", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) RPopLPush(ctx context.Context, source, destination string) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "rpoplpush", source, destination)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) RPush(ctx context.Context, key string, values ...interface{}) *redis.IntCmd {
	args := append([]interface{}{"rpush", key}, values...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) RPushX(ctx context.Context, key string, values ...interface{}) *redis.IntCmd {
	args := append([]interface{}{"rpushx", key}, values...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Append(ctx context.Context, key, value string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "append", key, value)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

// Sorted set operations
func (m *mockPipeline) BZPopMax(ctx context.Context, timeout time.Duration, keys ...string) *redis.ZWithKeyCmd {
	args := make([]interface{}, len(keys)+1)
	for i, k := range keys {
		args[i] = k
	}
	args[len(keys)] = timeout.Seconds()
	cmd := redis.NewZWithKeyCmd(ctx, append([]interface{}{"bzpopmax"}, args...)...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) BZPopMin(ctx context.Context, timeout time.Duration, keys ...string) *redis.ZWithKeyCmd {
	args := make([]interface{}, len(keys)+1)
	for i, k := range keys {
		args[i] = k
	}
	args[len(keys)] = timeout.Seconds()
	cmd := redis.NewZWithKeyCmd(ctx, append([]interface{}{"bzpopmin"}, args...)...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

// Server/admin operations
func (m *mockPipeline) BgRewriteAOF(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "bgrewriteaof")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) BgSave(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "bgsave")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClientKill(ctx context.Context, ipPort string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "client", "kill", ipPort)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClientList(ctx context.Context) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "client", "list")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClientPause(ctx context.Context, dur time.Duration) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "client", "pause", dur.Milliseconds())
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClientID(ctx context.Context) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "client", "id")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClientGetName(ctx context.Context) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "client", "getname")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClientSetName(ctx context.Context, name string) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "client", "setname", name)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClientKillByFilter(ctx context.Context, keys ...string) *redis.IntCmd {
	args := append([]interface{}{"client", "kill"}, interfaceSlice(keys)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClientUnblock(ctx context.Context, id int64) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "client", "unblock", id)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClientUnblockWithError(ctx context.Context, id int64) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "client", "unblock", id, "error")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ConfigGet(ctx context.Context, parameter string) *redis.SliceCmd {
	cmd := redis.NewSliceCmd(ctx, "config", "get", parameter)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ConfigResetStat(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "config", "resetstat")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ConfigSet(ctx context.Context, parameter, value string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "config", "set", parameter, value)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ConfigRewrite(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "config", "rewrite")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Copy(ctx context.Context, sourceKey, destKey string, db int, replace bool) *redis.IntCmd {
	args := []interface{}{"copy", sourceKey, destKey}
	if db > 0 {
		args = append(args, "db", db)
	}
	if replace {
		args = append(args, "replace")
	}
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Del(ctx context.Context, keys ...string) *redis.IntCmd {
	args := append([]interface{}{"del"}, interfaceSlice(keys)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Unlink(ctx context.Context, keys ...string) *redis.IntCmd {
	args := append([]interface{}{"unlink"}, interfaceSlice(keys)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Dump(ctx context.Context, key string) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "dump", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Exists(ctx context.Context, keys ...string) *redis.IntCmd {
	args := append([]interface{}{"exists"}, interfaceSlice(keys)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ExpireNX(ctx context.Context, key string, expiration time.Duration) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "expirenx", key, int64(expiration.Seconds()))
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ExpireXX(ctx context.Context, key string, expiration time.Duration) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "expirexx", key, int64(expiration.Seconds()))
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ExpireGT(ctx context.Context, key string, expiration time.Duration) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "expiregt", key, int64(expiration.Seconds()))
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ExpireLT(ctx context.Context, key string, expiration time.Duration) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "expirelt", key, int64(expiration.Seconds()))
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Keys(ctx context.Context, pattern string) *redis.StringSliceCmd {
	cmd := redis.NewStringSliceCmd(ctx, "keys", pattern)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Migrate(ctx context.Context, host, port, key string, db int, timeout time.Duration) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "migrate", host, port, key, db, int64(timeout.Seconds()))
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Move(ctx context.Context, key string, db int) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "move", key, db)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ObjectRefCount(ctx context.Context, key string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "object", "refcount", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ObjectEncoding(ctx context.Context, key string) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "object", "encoding", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ObjectIdleTime(ctx context.Context, key string) *redis.DurationCmd {
	cmd := redis.NewDurationCmd(ctx, 0, "object", "idletime", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Persist(ctx context.Context, key string) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "persist", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) PExpire(ctx context.Context, key string, expiration time.Duration) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "pexpire", key, expiration.Milliseconds())
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) PExpireAt(ctx context.Context, key string, tm time.Time) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "pexpireat", key, tm.UnixMilli())
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) PTTL(ctx context.Context, key string) *redis.DurationCmd {
	cmd := redis.NewDurationCmd(ctx, -1*time.Millisecond, "pttl", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) RandomKey(ctx context.Context) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "randomkey")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Rename(ctx context.Context, key, newkey string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "rename", key, newkey)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) RenameNX(ctx context.Context, key, newkey string) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "renamenx", key, newkey)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Restore(ctx context.Context, key string, ttl time.Duration, value string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "restore", key, int64(ttl.Milliseconds()), value)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) RestoreReplace(ctx context.Context, key string, ttl time.Duration, value string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "restore", key, int64(ttl.Milliseconds()), value, "replace")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Sort(ctx context.Context, key string, sort *redis.Sort) *redis.StringSliceCmd {
	args := []interface{}{"sort", key}
	if sort != nil {
		if sort.By != "" {
			args = append(args, "by", sort.By)
		}
		if sort.Order != "" {
			args = append(args, sort.Order)
		}
		if sort.Alpha {
			args = append(args, "alpha")
		}
		if sort.Offset > 0 || sort.Count > 0 {
			args = append(args, "limit", sort.Offset, sort.Count)
		}
	}
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SortStore(ctx context.Context, key, store string, sort *redis.Sort) *redis.IntCmd {
	args := []interface{}{"sort", key}
	if sort != nil {
		if sort.By != "" {
			args = append(args, "by", sort.By)
		}
		if sort.Order != "" {
			args = append(args, sort.Order)
		}
		if sort.Alpha {
			args = append(args, "alpha")
		}
		if sort.Offset > 0 || sort.Count > 0 {
			args = append(args, "limit", sort.Offset, sort.Count)
		}
	}
	args = append(args, "store", store)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SortInterfaces(ctx context.Context, key string, sort *redis.Sort) *redis.SliceCmd {
	args := []interface{}{"sort", key}
	if sort != nil {
		if sort.By != "" {
			args = append(args, "by", sort.By)
		}
		if sort.Order != "" {
			args = append(args, sort.Order)
		}
		if sort.Alpha {
			args = append(args, "alpha")
		}
		if sort.Offset > 0 || sort.Count > 0 {
			args = append(args, "limit", sort.Offset, sort.Count)
		}
	}
	cmd := redis.NewSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Touch(ctx context.Context, keys ...string) *redis.IntCmd {
	args := append([]interface{}{"touch"}, interfaceSlice(keys)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Type(ctx context.Context, key string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "type", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Scan(ctx context.Context, cursor uint64, match string, count int64) *redis.ScanCmd {
	args := []interface{}{cursor}
	if match != "" {
		args = append(args, "match", match)
	}
	if count > 0 {
		args = append(args, "count", count)
	}
	// Use a simple approach - create a basic scan cmd
	var cmd redis.ScanCmd
	cmd.SetVal([]string{}, 0)
	m.cmds = append(m.cmds, &cmd)
	return &cmd
}

func (m *mockPipeline) ScanType(ctx context.Context, cursor uint64, match string, count int64, keyType string) *redis.ScanCmd {
	args := []interface{}{cursor}
	if match != "" {
		args = append(args, "match", match)
	}
	if count > 0 {
		args = append(args, "count", count)
	}
	if keyType != "" {
		args = append(args, "type", keyType)
	}
	var cmd redis.ScanCmd
	cmd.SetVal([]string{}, 0)
	m.cmds = append(m.cmds, &cmd)
	return &cmd
}

func (m *mockPipeline) SetArgs(ctx context.Context, key string, value interface{}, a redis.SetArgs) *redis.StatusCmd {
	args := []interface{}{"set", key, value}
	if a.TTL > 0 {
		args = append(args, "ex", int64(a.TTL.Seconds()))
	}
	if a.Mode != "" {
		args = append(args, a.Mode)
	}
	if a.KeepTTL {
		args = append(args, "keepttl")
	}
	cmd := redis.NewStatusCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) DBSize(ctx context.Context) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "dbsize")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) FlushAll(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "flushall")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) FlushAllAsync(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "flushall", "async")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) FlushDB(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "flushdb")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) FlushDBAsync(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "flushdb", "async")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Info(ctx context.Context, section ...string) *redis.StringCmd {
	args := append([]interface{}{"info"}, interfaceSlice(section)...)
	cmd := redis.NewStringCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) LastSave(ctx context.Context) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "lastsave")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Save(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "save")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Shutdown(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "shutdown")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ShutdownSave(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "shutdown", "save")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ShutdownNoSave(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "shutdown", "nosave")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SlaveOf(ctx context.Context, host, port string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "slaveof", host, port)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Time(ctx context.Context) *redis.TimeCmd {
	cmd := redis.NewTimeCmd(ctx, "time")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) DebugObject(ctx context.Context, key string) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "debug", "object", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ReadOnly(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "readonly")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ReadWrite(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "readwrite")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) MemoryUsage(ctx context.Context, key string, samples ...int) *redis.IntCmd {
	args := append([]interface{}{"memory", "usage", key}, interfaceSlice(samples)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

// String/bit operations
func (m *mockPipeline) BitCount(ctx context.Context, key string, bitCount *redis.BitCount) *redis.IntCmd {
	args := []interface{}{"bitcount", key}
	if bitCount != nil {
		args = append(args, bitCount.Start, bitCount.End)
	}
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) BitOpAnd(ctx context.Context, destKey string, keys ...string) *redis.IntCmd {
	args := append([]interface{}{"bitop", "and", destKey}, interfaceSlice(keys)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) BitOpOr(ctx context.Context, destKey string, keys ...string) *redis.IntCmd {
	args := append([]interface{}{"bitop", "or", destKey}, interfaceSlice(keys)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) BitOpXor(ctx context.Context, destKey string, keys ...string) *redis.IntCmd {
	args := append([]interface{}{"bitop", "xor", destKey}, interfaceSlice(keys)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) BitOpNot(ctx context.Context, destKey, key string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "bitop", "not", destKey, key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) BitPos(ctx context.Context, key string, bit int64, pos ...int64) *redis.IntCmd {
	args := append([]interface{}{"bitpos", key, bit}, interfaceSlice(pos)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) BitField(ctx context.Context, key string, args ...interface{}) *redis.IntSliceCmd {
	cmdArgs := append([]interface{}{"bitfield", key}, args...)
	cmd := redis.NewIntSliceCmd(ctx, cmdArgs...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Decr(ctx context.Context, key string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "decr", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) DecrBy(ctx context.Context, key string, decrement int64) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "decrby", key, decrement)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Get(ctx context.Context, key string) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "get", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GetBit(ctx context.Context, key string, offset int64) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "getbit", key, offset)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GetRange(ctx context.Context, key string, start, end int64) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "getrange", key, start, end)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GetSet(ctx context.Context, key string, value interface{}) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "getset", key, value)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GetDel(ctx context.Context, key string) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "getdel", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) GetEx(ctx context.Context, key string, expiration time.Duration) *redis.StringCmd {
	args := []interface{}{"getex", key}
	if expiration > 0 {
		args = append(args, "ex", int64(expiration.Seconds()))
	}
	cmd := redis.NewStringCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

// Hash operations
func (m *mockPipeline) HDel(ctx context.Context, key string, fields ...string) *redis.IntCmd {
	args := append([]interface{}{"hdel", key}, interfaceSlice(fields)...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) HExists(ctx context.Context, key, field string) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "hexists", key, field)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) HGet(ctx context.Context, key, field string) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "hget", key, field)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) HGetAll(ctx context.Context, key string) *redis.StringStringMapCmd {
	cmd := redis.NewStringStringMapCmd(ctx, "hgetall", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) HIncrBy(ctx context.Context, key, field string, incr int64) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "hincrby", key, field, incr)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) HIncrByFloat(ctx context.Context, key, field string, incr float64) *redis.FloatCmd {
	cmd := redis.NewFloatCmd(ctx, "hincrbyfloat", key, field, incr)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) HKeys(ctx context.Context, key string) *redis.StringSliceCmd {
	cmd := redis.NewStringSliceCmd(ctx, "hkeys", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) HLen(ctx context.Context, key string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "hlen", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) HMGet(ctx context.Context, key string, fields ...string) *redis.SliceCmd {
	args := append([]interface{}{"hmget", key}, interfaceSlice(fields)...)
	cmd := redis.NewSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) HMSet(ctx context.Context, key string, values ...interface{}) *redis.BoolCmd {
	args := append([]interface{}{"hmset", key}, values...)
	cmd := redis.NewBoolCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) HSet(ctx context.Context, key string, values ...interface{}) *redis.IntCmd {
	args := append([]interface{}{"hset", key}, values...)
	cmd := redis.NewIntCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) HSetNX(ctx context.Context, key, field string, value interface{}) *redis.BoolCmd {
	cmd := redis.NewBoolCmd(ctx, "hsetnx", key, field, value)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) HVals(ctx context.Context, key string) *redis.StringSliceCmd {
	cmd := redis.NewStringSliceCmd(ctx, "hvals", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) HRandField(ctx context.Context, key string, count int, withValues bool) *redis.StringSliceCmd {
	args := []interface{}{"hrandfield", key}
	if count > 0 {
		args = append(args, count)
		if withValues {
			args = append(args, "withvalues")
		}
	}
	cmd := redis.NewStringSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) HScan(ctx context.Context, key string, cursor uint64, match string, count int64) *redis.ScanCmd {
	args := []interface{}{cursor}
	if match != "" {
		args = append(args, "match", match)
	}
	if count > 0 {
		args = append(args, "count", count)
	}
	var cmd redis.ScanCmd
	cmd.SetVal([]string{}, 0)
	m.cmds = append(m.cmds, &cmd)
	return &cmd
}

func (m *mockPipeline) IncrBy(ctx context.Context, key string, value int64) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "incrby", key, value)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) IncrByFloat(ctx context.Context, key string, value float64) *redis.FloatCmd {
	cmd := redis.NewFloatCmd(ctx, "incrbyfloat", key, value)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) MGet(ctx context.Context, keys ...string) *redis.SliceCmd {
	args := append([]interface{}{"mget"}, interfaceSlice(keys)...)
	cmd := redis.NewSliceCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) MSet(ctx context.Context, pairs ...interface{}) *redis.StatusCmd {
	args := append([]interface{}{"mset"}, pairs...)
	cmd := redis.NewStatusCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) MSetNX(ctx context.Context, pairs ...interface{}) *redis.BoolCmd {
	args := append([]interface{}{"msetnx"}, pairs...)
	cmd := redis.NewBoolCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Set(ctx context.Context, key string, value interface{}, expiration time.Duration) *redis.StatusCmd {
	args := []interface{}{"set", key, value}
	if expiration > 0 {
		args = append(args, "ex", int64(expiration.Seconds()))
	}
	cmd := redis.NewStatusCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SetEX(ctx context.Context, key string, value interface{}, expiration time.Duration) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "setex", key, int64(expiration.Seconds()), value)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SetBit(ctx context.Context, key string, offset int64, value int) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "setbit", key, offset, value)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SetNX(ctx context.Context, key string, value interface{}, expiration time.Duration) *redis.BoolCmd {
	args := []interface{}{"setnx", key, value}
	if expiration > 0 {
		args = append(args, "ex", int64(expiration.Seconds()))
	}
	cmd := redis.NewBoolCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SetXX(ctx context.Context, key string, value interface{}, expiration time.Duration) *redis.BoolCmd {
	args := []interface{}{"setxx", key, value}
	if expiration > 0 {
		args = append(args, "ex", int64(expiration.Seconds()))
	}
	cmd := redis.NewBoolCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) SetRange(ctx context.Context, key string, offset int64, value string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "setrange", key, offset, value)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) StrLen(ctx context.Context, key string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "strlen", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

// Cluster operations - stub implementations
func (m *mockPipeline) ClusterAddSlots(ctx context.Context, slots ...int) *redis.StatusCmd {
	args := append([]interface{}{"cluster", "addslots"}, interfaceSlice(slots)...)
	cmd := redis.NewStatusCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterAddSlotsRange(ctx context.Context, min, max int) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "cluster", "addslotsrange", min, max)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterDelSlots(ctx context.Context, slots ...int) *redis.StatusCmd {
	args := append([]interface{}{"cluster", "delslots"}, interfaceSlice(slots)...)
	cmd := redis.NewStatusCmd(ctx, args...)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterDelSlotsRange(ctx context.Context, min, max int) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "cluster", "delslotsrange", min, max)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterFailover(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "cluster", "failover")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterFailoverForce(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "cluster", "failover", "force")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterFailoverTakeover(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "cluster", "failover", "takeover")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterForget(ctx context.Context, nodeID string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "cluster", "forget", nodeID)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterGetKeysInSlot(ctx context.Context, slot int, count int) *redis.StringSliceCmd {
	cmd := redis.NewStringSliceCmd(ctx, "cluster", "getkeysinslot", slot, count)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterInfo(ctx context.Context) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "cluster", "info")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterKeySlot(ctx context.Context, key string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "cluster", "keyslot", key)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterMeet(ctx context.Context, host, port string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "cluster", "meet", host, port)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterNodes(ctx context.Context) *redis.StringCmd {
	cmd := redis.NewStringCmd(ctx, "cluster", "nodes")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterReplicate(ctx context.Context, nodeID string) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "cluster", "replicate", nodeID)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterResetHard(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "cluster", "reset", "hard")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterResetSoft(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "cluster", "reset", "soft")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterSaveConfig(ctx context.Context) *redis.StatusCmd {
	cmd := redis.NewStatusCmd(ctx, "cluster", "saveconfig")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterSlaves(ctx context.Context, nodeID string) *redis.StringSliceCmd {
	cmd := redis.NewStringSliceCmd(ctx, "cluster", "slaves", nodeID)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterSlots(ctx context.Context) *redis.ClusterSlotsCmd {
	cmd := redis.NewClusterSlotsCmd(ctx, "cluster", "slots")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterCountFailureReports(ctx context.Context, nodeID string) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "cluster", "count-failure-reports", nodeID)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) ClusterCountKeysInSlot(ctx context.Context, slot int) *redis.IntCmd {
	cmd := redis.NewIntCmd(ctx, "cluster", "countkeysinslot", slot)
	m.cmds = append(m.cmds, cmd)
	return cmd
}

func (m *mockPipeline) Command(ctx context.Context) *redis.CommandsInfoCmd {
	cmd := redis.NewCommandsInfoCmd(ctx, "command")
	m.cmds = append(m.cmds, cmd)
	return cmd
}

// Helper function to convert slice to interface slice
func interfaceSlice(slice interface{}) []interface{} {
	s := reflect.ValueOf(slice)
	if s.Kind() != reflect.Slice {
		return nil
	}
	ret := make([]interface{}, s.Len())
	for i := 0; i < s.Len(); i++ {
		ret[i] = s.Index(i).Interface()
	}
	return ret
}

func TestRateLimiter_AllowRequest(t *testing.T) {
	mockRedis := newMockRedisClient()
	limiter := NewRateLimiter(mockRedis, 10, 1*time.Minute)

	handler := limiter.RateLimitMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	req := httptest.NewRequest("GET", "/test", nil)
	ctx := context.WithValue(req.Context(), "tenant_id", uuid.New())
	req = req.WithContext(ctx)

	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusOK, w.Code)
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Limit"))
	assert.NotEmpty(t, w.Header().Get("X-RateLimit-Remaining"))
}

func TestRateLimiter_ExceedLimit(t *testing.T) {
	mockRedis := newMockRedisClient()
	limiter := NewRateLimiter(mockRedis, 2, 1*time.Minute)

	handler := limiter.RateLimitMiddleware(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
	}))

	tenantID := uuid.New()
	ctx := context.WithValue(context.Background(), "tenant_id", tenantID)

	// Make requests up to limit
	for i := 0; i < 2; i++ {
		req := httptest.NewRequest("GET", "/test", nil)
		req = req.WithContext(ctx)
		w := httptest.NewRecorder()
		handler.ServeHTTP(w, req)
		assert.Equal(t, http.StatusOK, w.Code)
	}

	// Next request should be rate limited
	req := httptest.NewRequest("GET", "/test", nil)
	req = req.WithContext(ctx)
	w := httptest.NewRecorder()
	handler.ServeHTTP(w, req)

	assert.Equal(t, http.StatusTooManyRequests, w.Code)
	assert.Equal(t, "0", w.Header().Get("X-RateLimit-Remaining"))
	assert.NotEmpty(t, w.Header().Get("Retry-After"))
}

func TestRateLimiter_GetClientIP(t *testing.T) {
	mockRedis := newMockRedisClient()
	limiter := NewRateLimiter(mockRedis, 10, 1*time.Minute)

	// Test X-Forwarded-For header
	req := httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Forwarded-For", "192.168.1.1, 10.0.0.1")
	ip := limiter.getClientIP(req)
	assert.Equal(t, "192.168.1.1", ip)

	// Test X-Real-IP header
	req = httptest.NewRequest("GET", "/test", nil)
	req.Header.Set("X-Real-IP", "10.0.0.2")
	ip = limiter.getClientIP(req)
	assert.Equal(t, "10.0.0.2", ip)

	// Test RemoteAddr fallback
	req = httptest.NewRequest("GET", "/test", nil)
	req.RemoteAddr = "192.168.1.100:12345"
	ip = limiter.getClientIP(req)
	assert.Equal(t, "192.168.1.100", ip)
}

func TestRateLimiter_EndpointSpecificLimits(t *testing.T) {
	mockRedis := newMockRedisClient()
	limiter := NewRateLimiter(mockRedis, 10, 1*time.Minute)

	// Set custom limit for specific endpoint
	limiter.SetEndpointLimit("/api/v1/auth/login", 5, 1*time.Minute)

	limit, window := limiter.getLimitForEndpoint("/api/v1/auth/login")
	assert.Equal(t, 5, limit)
	assert.Equal(t, 1*time.Minute, window)

	// Default limit for other endpoints
	limit, window = limiter.getLimitForEndpoint("/api/v1/other")
	assert.Equal(t, 10, limit)
	assert.Equal(t, 1*time.Minute, window)
}
