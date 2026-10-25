// Daftar terpusat semua "fitur" yang bisa di-permission-kan admin per
// user (di /dashboard/user-management). feature_key HARUS sama persis
// dengan path segment setelah /dashboard/ dipakai Sidebar.tsx, karena
// dipakai juga buat nge-filter menu sidebar sesuai permission user yang
// login. "Home" sengaja TIDAK ada di sini — semua user approved selalu
// boleh akses Home, nggak perlu di-grant manual.
export interface FeatureDef { key: string; label: string; group: string }

export const FEATURES: FeatureDef[] = [
  // Productivity
  { key: "kanban",               label: "Kanban",             group: "Productivity" },
  { key: "notulensi",            label: "Notulensi",          group: "Productivity" },
  { key: "our-system",           label: "Our System",         group: "Productivity" },
  // Support Lokal
  { key: "vm-db",                label: "VM DB",               group: "Support Lokal" },
  { key: "owncloud-admin",       label: "OwnCloud Logs",       group: "Support Lokal" },
  // Support PHI
  { key: "logix-tickets",        label: "Ticket Logix",        group: "Support PHI" },
  { key: "target-compare",       label: "Compare Target",      group: "Support PHI" },
  { key: "mpp-compare",          label: "Compare MPP",         group: "Support PHI" },
  { key: "mpp-health",           label: "MPP Health",          group: "Support PHI" },
  { key: "omzet-phi",            label: "Omzet PHI",           group: "Support PHI" },
  { key: "landing-admin",        label: "Sharing Knowledge",   group: "Support PHI" },
  { key: "backlog-phi",          label: "Backlog PHI",         group: "Support PHI" },
  // Data Transfer (sub-group Support PHI)
  { key: "data-transfer",        label: "Web Ficom",           group: "Data Transfer" },
  { key: "ho-transfer",          label: "Matrix HO",           group: "Data Transfer" },
  // Backup & Restore
  { key: "restore-phi",          label: "Restore DB PHI",      group: "Backup & Restore" },
  { key: "backup-phi",           label: "Backup DB PHI",       group: "Backup & Restore" },
  // Utilisasi
  { key: "edi",                  label: "EDI Ficom",           group: "Utilisasi" },
  { key: "sfa-upload",           label: "SFA Upload",          group: "Utilisasi" },
  { key: "ficom-upload",         label: "Ficom Upload",        group: "Utilisasi" },
  { key: "ficom-lite-upload",    label: "Ficom Lite Upload",   group: "Utilisasi" },
  // Master
  { key: "master-utilisasi",     label: "Master Utilisasi",    group: "Master" },
  { key: "master-data",          label: "Master Data",         group: "Master" },
  { key: "ficom-password",       label: "Ficom Password",      group: "Master" },
  // Dokumen
  { key: "knowledge-base",       label: "Knowledge Base",      group: "Dokumen" },
  { key: "docreq",               label: "Doc Req",             group: "Dokumen" },
  { key: "userflow",             label: "User Flow",           group: "Dokumen" },
  { key: "scenario-test",        label: "Scenario Test",       group: "Dokumen" },
  { key: "poster-gen",           label: "Poster Generator",    group: "Dokumen" },
  { key: "superhuman-docs",      label: "Superhuman Docs",     group: "Dokumen" },
  { key: "pilot-plan",           label: "Plan Pilot SFA",      group: "Dokumen" },
]

export const FEATURE_GROUPS: string[] = Array.from(new Set(FEATURES.map(f => f.group)))

// Path dashboard pertama (segment setelah /dashboard/) dari sebuah pathname,
// dipakai buat cocokin ke feature_key. "/dashboard" atau "/dashboard/" sendiri
// (Home) balikin null karena nggak perlu permission.
export function featureKeyFromPath(pathname: string): string | null {
  const m = /^\/dashboard\/([^/]+)/.exec(pathname)
  return m ? m[1] : null
}
