# Troubleshooting Guide: MikroTik Connection

## Quick Start

### Step 1: Test dari VPS (SSH ke VPS)

```bash
# SSH ke VPS
ssh root@72.60.74.209

# Masuk ke project directory
cd /opt/rrnet

# Jalankan script test koneksi
bash scripts/test_mikrotik_connection.sh
```

**Hasil yang diharapkan:**
- ✓ Port 8728 bisa diakses → Lanjut ke Step 2
- ✗ Port 8728 tidak bisa diakses → Periksa firewall MikroTik (Step 3)

---

### Step 2: Cek Backend di VPS

```bash
# Masih di VPS, jalankan script check backend
bash scripts/check_backend_vps.sh
```

**Atau jalankan all-in-one checklist:**
```bash
bash scripts/check_all_vps.sh
```

**Hasil yang diharapkan:**
- ✓ Backend service: RUNNING
- ✓ Backend binary ditemukan
- ✓ Backend health check: OK

**Jika ada yang ✗:**
```bash
# Deploy dan rebuild backend
bash scripts/deploy_and_test.sh
```

---

### Step 3: Cek Firewall MikroTik

1. Buka **Winbox** → **Terminal**
2. Buka file `scripts/mikrotik_check_commands.txt`
3. Copy-paste command berikut satu per satu:

```bash
# Command 1: Cek firewall rule untuk VPS
/ip firewall filter print where chain=input and src-address=72.60.74.209

# Command 2: Cek API service
/ip service print where name=api

# Command 3: Cek semua input rules (untuk lihat posisi)
/ip firewall filter print where chain=input
```

**Hasil yang diharapkan:**
- Ada rule dengan `src-address=72.60.74.209`, `dst-port=8728`, `action=accept`
- API service menunjukkan `enabled`
- Rule allow ada di atas rule deny

**Jika rule belum ada, tambahkan:**
```bash
/ip firewall filter add chain=input protocol=tcp dst-port=8728 src-address=72.60.74.209 action=accept place-before=0
```

**Jika API service belum enabled:**
```bash
/ip service enable api
```

---

## Script Files

### 1. `test_mikrotik_connection.sh`
Test koneksi dari VPS ke MikroTik API port 8728.

**Cara pakai:**
```bash
ssh root@72.60.74.209
cd /opt/rrnet
bash scripts/test_mikrotik_connection.sh
```

---

### 2. `check_backend_vps.sh`
Cek status backend service, binary, git, dan health check.

**Cara pakai:**
```bash
ssh root@72.60.74.209
cd /opt/rrnet
bash scripts/check_backend_vps.sh
```

---

### 3. `check_all_vps.sh`
All-in-one checklist untuk semua test di VPS.

**Cara pakai:**
```bash
ssh root@72.60.74.209
cd /opt/rrnet
bash scripts/check_all_vps.sh
```

---

### 4. `deploy_and_test.sh`
Pull code, rebuild backend, restart service, dan test.

**Cara pakai:**
```bash
ssh root@72.60.74.209
cd /opt/rrnet
bash scripts/deploy_and_test.sh
```

---

### 5. `mikrotik_check_commands.txt`
List command untuk cek MikroTik (copy-paste ke Winbox Terminal).

**Cara pakai:**
1. Buka Winbox → Terminal
2. Buka file `scripts/mikrotik_check_commands.txt`
3. Copy-paste command yang ingin dijalankan
4. Screenshot hasilnya

---

## Troubleshooting Flow

```
1. Test koneksi VPS → MikroTik
   ├─ ✓ OK → Lanjut ke Step 2
   └─ ✗ FAILED → Periksa firewall MikroTik (Step 3)

2. Cek Backend di VPS
   ├─ ✓ Semua OK → Test di web project
   └─ ✗ Ada masalah → Jalankan deploy_and_test.sh

3. Cek Firewall MikroTik
   ├─ Rule belum ada → Tambahkan rule allow
   ├─ API service disabled → Enable API service
   └─ Rule di bawah deny → Pindahkan ke atas

4. Test di Web Project
   ├─ ✓ Connection OK → Selesai!
   └─ ✗ Masih timeout → Cek log backend
```

---

## Common Issues

### Issue 1: Port 8728 tidak bisa diakses dari VPS

**Penyebab:**
- Firewall MikroTik belum allow IP VPS
- Port forwarding belum benar
- API service belum enabled

**Solusi:**
1. Tambahkan firewall rule di MikroTik:
   ```bash
   /ip firewall filter add chain=input protocol=tcp dst-port=8728 src-address=72.60.74.209 action=accept place-before=0
   ```
2. Enable API service:
   ```bash
   /ip service enable api
   ```
3. Test lagi dari VPS

---

### Issue 2: Backend service tidak running

**Solusi:**
```bash
# Cek log error
journalctl -u rrnet-backend -n 50 --no-pager

# Start service
systemctl start rrnet-backend

# Cek status
systemctl status rrnet-backend
```

---

### Issue 3: Backend binary tidak ditemukan atau outdated

**Solusi:**
```bash
cd /opt/rrnet
bash scripts/deploy_and_test.sh
```

---

### Issue 4: Connection timeout di web project

**Penyebab:**
- Backend belum di-rebuild setelah perubahan timeout wrapper
- Firewall MikroTik belum benar
- Network issue

**Solusi:**
1. Rebuild dan restart backend:
   ```bash
   bash scripts/deploy_and_test.sh
   ```
2. Pastikan firewall MikroTik sudah benar (Step 3)
3. Test lagi di web project

---

## Next Steps

Setelah semua checklist ✓:
1. Test di web project: `http://72.60.74.209:3000/network/routers/create`
2. Isi form dengan data MikroTik
3. Klik "Test Connection"
4. Jika berhasil, klik "Create Router"

---

## Support

Jika masih ada masalah setelah mengikuti guide ini:
1. Screenshot hasil dari semua script
2. Screenshot hasil command MikroTik
3. Screenshot error di web project
4. Kirim ke developer untuk analisis lebih lanjut

