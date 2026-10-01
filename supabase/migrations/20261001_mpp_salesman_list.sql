-- ============================================================
-- Tambah kolom buat nyimpen daftar MENTAH salesman (bukan cuma angka
-- agregat) di snapshot harian & bulanan Compare MPP — dibutuhin buat fitur
-- "selisih" (diff sls_id+distributor_id antara 2 snapshot), biar bisa
-- ditunjukkin SIAPA aja bedanya, bukan cuma angkanya doang.
-- ============================================================
ALTER TABLE mpp_compare_snapshot ADD COLUMN IF NOT EXISTS edi_salesman_list jsonb DEFAULT '[]';
-- [{key, slsId, distributorId, name, rdmId, rdmName}]

ALTER TABLE mpp_period_snapshot ADD COLUMN IF NOT EXISTS edi_salesman_list jsonb DEFAULT '[]';
-- [{key, slsId, distributorId, name, rdmId, rdmName}]
