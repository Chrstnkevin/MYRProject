-- ============================================================
-- Breakdown sampai level ADM (bukan cuma RDM) di Compare MPP — kolom
-- tambahan, RDM-level (ficom_lite_by_rdm/edi_by_rdm) tetap dipakai apa
-- adanya, ini cuma nambah rincian 1 level lebih dalam.
-- ============================================================
ALTER TABLE mpp_compare_snapshot ADD COLUMN IF NOT EXISTS ficom_lite_by_adm jsonb DEFAULT '[]';
-- [{empId, name, active, total, rdmId, rdmName}]
ALTER TABLE mpp_compare_snapshot ADD COLUMN IF NOT EXISTS edi_by_adm jsonb DEFAULT '[]';
-- [{empId, name, active, rdmId, rdmName}]

ALTER TABLE mpp_period_snapshot ADD COLUMN IF NOT EXISTS edi_by_adm jsonb DEFAULT '[]';
-- [{empId, name, active, rdmId, rdmName}]
