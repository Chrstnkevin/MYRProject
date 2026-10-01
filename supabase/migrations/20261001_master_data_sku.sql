-- ============================================================
-- Maintenance Produk — katalog SKU (reguler & promo) dari file pricelist
-- Ficom "GENERAL_PRICE_PER_SKU ..." (sheet "ALL SKU" + "PROMO SKU").
--
-- 1 baris per (sku_code, is_promo) — SENGAJA bukan per sku_code doang,
-- soalnya dari capture file user, 17 dari 19 kode di sheet PROMO SKU
-- itu TUMPANG TINDIH sama kode yang juga ada di sheet ALL SKU (sebagai
-- produk reguler), dengan harga yang beda (harga promo vs harga biasa).
-- Supaya dua konteks itu nggak saling timpa pas import, kode yang sama
-- bisa punya 2 baris: 1 produk reguler (is_promo=false, dari ALL SKU),
-- 1 promo (is_promo=true, dari PROMO SKU).
--
-- is_active DEFAULT true dan SENGAJA tidak di-include di payload upsert
-- sync (lihat ProductMaintenance.tsx) biar re-import (update harga) nggak
-- nge-reset toggle Active/Inactive yang sudah di-set manual oleh user.
-- ============================================================
CREATE TABLE IF NOT EXISTS master_data_sku (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  sku_code         text NOT NULL,
  sku_description  text,
  is_promo         boolean NOT NULL DEFAULT false,
  price_large      numeric,
  price_medium     numeric,
  price_small      numeric,
  is_active        boolean NOT NULL DEFAULT true,
  updated_at       timestamptz DEFAULT now(),
  UNIQUE (sku_code, is_promo)
);

CREATE INDEX IF NOT EXISTS idx_master_data_sku_code ON master_data_sku (sku_code);

ALTER TABLE master_data_sku DISABLE ROW LEVEL SECURITY;
