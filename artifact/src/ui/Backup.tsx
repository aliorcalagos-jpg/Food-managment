import { useState } from "react";
import { BACKUP_NUDGE_DAYS, LAST_BACKUP_KEY, backupFileName, buildBackup, daysSince, parseBackup, planImport, type Backup as BackupFile, type Counts, type ImportMode } from "../backup";
import { useI18n, type MsgKey } from "../i18n";
import { haptic, pickTextFile, saveTextFile } from "../native";
import type { Store } from "../store";
import { Sheet } from "./common";

const lastBackup = (): string | null => {
  try {
    return localStorage.getItem(LAST_BACKUP_KEY);
  } catch {
    return null;
  }
};

/** Save everything to a file and bring it back: the only copy of the data on the phone is the phone itself. */
export function BackupCard({ store }: { store: Store }) {
  const { t } = useI18n();
  const [last, setLast] = useState(lastBackup);
  const [note, setNote] = useState<{ key: MsgKey; params?: Record<string, string | number>; bad?: boolean } | null>(null);
  const [incoming, setIncoming] = useState<{ backup: BackupFile; counts: Counts } | null>(null);
  const [replacing, setReplacing] = useState(false);
  const days = daysSince(last);
  const due = days === null || days >= BACKUP_NUDGE_DAYS;

  async function exportFile() {
    const s = store.getState();
    const now = new Date();
    const text = JSON.stringify(buildBackup({ recipes: s.recipes, weeks: s.weeks, lists: s.lists, settings: s.settings }, now), null, 2);
    if (!(await saveTextFile(backupFileName(now), text))) return;
    try {
      localStorage.setItem(LAST_BACKUP_KEY, now.toISOString());
    } catch {
      /* storage unavailable */
    }
    setLast(now.toISOString());
    setNote({ key: "backupSaved" });
    haptic("success");
  }

  async function chooseFile() {
    setNote(null);
    const text = await pickTextFile();
    if (text === null) return;
    const r = parseBackup(text);
    if (!r.ok) return setNote({ key: r.error === "notJson" ? "backupErrNotJson" : r.error === "tooNew" ? "backupErrTooNew" : "backupErrNotBackup", bad: true });
    setIncoming({ backup: r.backup, counts: r.counts });
  }

  async function restore(mode: ImportMode) {
    if (!incoming) return;
    const s = store.getState();
    const ops = planImport(incoming.backup, { recipes: s.recipes, weeks: s.weeks, lists: s.lists, settings: s.settings }, mode);
    const counts = incoming.counts;
    setIncoming(null);
    setReplacing(false);
    const ok = await store.applyImport(ops);
    setNote(ok ? { key: "backupRestored", params: { recipes: counts.recipes, weeks: counts.weeks, lists: counts.lists } } : { key: "backupErrWrite", bad: true });
    if (ok) haptic("success");
  }

  return (
    <section className="card backup" aria-labelledby="backup-h" data-pilot="backup">
      <h3 id="backup-h">{t("backupH")}</h3>
      <p className="muted small">{t("backupHint")}</p>
      <p className={due ? "backup-last due" : "backup-last"} aria-live="polite">
        {days === null ? t("backupNever") : days === 0 ? t("backupToday") : t("backupDaysAgo", { n: days })}
        {due && days !== null && <> · {t("backupDue")}</>}
      </p>
      <div className="actions">
        <button type="button" className="btn primary" onClick={() => void exportFile()}>
          {t("backupExport")}
        </button>
        <button type="button" className="btn" onClick={() => void chooseFile()}>
          {t("backupImport")}
        </button>
      </div>
      {note && (
        <p className={note.bad ? "field-error" : "backup-ok"} role={note.bad ? "alert" : "status"}>
          {t(note.key, note.params)}
        </p>
      )}
      {incoming && (
        <Sheet title={t("backupImport")} onClose={() => setIncoming(null)}>
          <p className="num">{t("backupPreview", { recipes: incoming.counts.recipes, weeks: incoming.counts.weeks, lists: incoming.counts.lists })}</p>
          <button type="button" className="btn primary block" onClick={() => void restore("merge")}>
            {t("backupMerge")}
          </button>
          <p className="muted small">{t("backupMergeHint")}</p>
          <button type="button" className="btn block" onClick={() => setReplacing(true)}>
            {t("backupReplace")}
          </button>
          <p className="muted small">{t("backupReplaceHint")}</p>
          {replacing && (
            <div className="sheet-overlay action-overlay" onMouseDown={(e) => e.target === e.currentTarget && setReplacing(false)}>
              <div className="action-sheet" role="dialog" aria-modal="true" aria-label={t("backupReplace")}>
                <div className="action-group">
                  <p className="action-title">{t("backupReplaceHint")}</p>
                  <button type="button" className="action-btn danger" onClick={() => void restore("replace")}>
                    {t("backupReplaceConfirm")}
                  </button>
                </div>
                <button type="button" className="action-btn cancel" onClick={() => setReplacing(false)}>
                  {t("cancel")}
                </button>
              </div>
            </div>
          )}
        </Sheet>
      )}
    </section>
  );
}
