# ROLE PERMISSION MATRIX (MVP - 1 Role per User)

Dokumen ini adalah **source of truth** untuk mapping `roles.code` → `roles.permissions` (string) yang dipakai RBAC engine.

Catatan penting:

- MVP kita **1 role per user** (kolom `users.role_id`).
- Tier gating (fitur per paket) adalah layer terpisah: **plan features/limits** bisa mematikan modul walaupun role punya permission.
- Format permission sekarang mengikuti `resource:action` + wildcard `*`.

## Permission string format

- `*`: full access (khusus super admin / internal)
- `resource:*`: full access untuk resource tsb
- `resource:read|create|update|delete|...`: granular

Resource yang sudah dipakai di seed saat ini:

- `tenant`, `user`, `billing`, `network`, `maps`, `hr`, `collector`, `technician`, `client`, `wa`, `addon`, `report`

## Seed saat ini (di code)

Sumber: `BE/migrations/000002_create_roles.up.sql`

| Role (`roles.code`) | Permissions (seed)                                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `super_admin`       | `["*"]`                                                                                                                             |
| `owner`             | `["tenant:*","user:*","billing:*","network:*","maps:*","hr:*","collector:*","technician:*","client:*","wa:*","addon:*","report:*"]` |
| `admin`             | `["user:read","user:create","user:update","network:*","maps:*","client:*","wa:read","wa:send","report:read"]`                       |
| `hr`                | `["hr:*","user:read","report:hr"]`                                                                                                  |
| `finance`           | `["billing:*","collector:read","report:finance","client:read"]`                                                                     |
| `technician`        | `["technician:*","maps:read","client:read","network:read"]`                                                                         |
| `collector`         | `["collector:*","client:read","billing:collect"]`                                                                                   |
| `client`            | `["client:self","billing:self","wa:receive"]`                                                                                       |

## Align dengan docs capability spec

Sumber capability (lebih detail):

- `docs_plan/old_plan/ROLE_CAPABILITY_SPEC.md`
- `docs_plan/old_plan/patch baru untuk modul Role & Cash.txt`
- `docs_plan/old_plan/prompt_v4.md`

Observasi (gap utama):

- Dokumen spec menyatakan **admin bisa “multifungsi” (Admin + HR + Finance)**, tapi seed admin sekarang **belum** mencakup `hr:*` dan `billing:*`.
- Spec juga menyebut “technician bisa multifungsi collector” → itu akan butuh **multi-role** atau **permissions yang digabung**. Karena MVP kita 1-role, opsi yang masuk akal adalah:
  - buat role baru `technician_collector` (custom role) dengan gabungan perms, atau
  - perluas `technician` (tidak disarankan karena collector visibility lebih ketat).

## Proposed permissions (untuk MVP yang kamu mau)

Tujuan: mendukung requirement kamu:

- Tier Basic: owner saja (tapi modul mengikuti plan features/limits)
- Tier RBAC: bisa breakdown tugas; admin boleh “multifungsi” (admin+hr+finance)

### Proposed changes (dokumen — belum dieksekusi)

| Role          | Proposed permissions                                                                                                                                                                         |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `super_admin` | tetap `["*"]`                                                                                                                                                                                |
| `owner`       | tetap luas (tenant full)                                                                                                                                                                     |
| `admin`       | tambahkan HR + Finance agar multifungsi: `["user:*","network:*","client:*","maps:*","hr:*","billing:*","collector:read","wa:*","report:*","addon:*"]` (tanpa aksi yang sifatnya super-admin) |
| `hr`          | tetap: `["hr:*","user:read","report:hr"]`                                                                                                                                                    |
| `finance`     | tetap, dan jika perlu tambahkan `billing:collect` bila finance bisa verifikasi setoran: `["billing:*","collector:read","report:finance","client:read"]`                                      |
| `technician`  | tetap terbatas (no billing/hr)                                                                                                                                                               |
| `collector`   | tetap terbatas (assignment-only + billing collect)                                                                                                                                           |
| `client`      | tetap self-only                                                                                                                                                                              |

Jika nanti kamu memutuskan “switch mode / multi-role”, dokumen ini akan diubah supaya permissions user = union(roleA, roleB, ...), dan `roles.permissions` bisa tetap lebih kecil per role.
