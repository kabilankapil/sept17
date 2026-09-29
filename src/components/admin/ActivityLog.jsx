// src/components/admin/ActivityLog.jsx
//
// 3-level view: File list → Activity list → Activity detail.
// Owns ["files"] and ["activityTypes"] React Query keys.
//
// Sub-components (./activityLog/):
//   ActivityTypeModal     — manage activity types popup
//
// Constants / helpers (./activityLog/):
//   activityLogConstants  — PURCHASE_DOCTYPE_OPTIONS, purchaseDoctypeLabel, emptyActForm

import { useState, useEffect, useRef } from "react";
import { useQuery, useQueries, useQueryClient } from "@tanstack/react-query";
import { getFiles, createFile, updateFile, deleteFile } from "../../api/files";
import { exportAll, exportFile } from "../../api/export";
import {
  getActivities, createActivity, updateActivity, deleteActivity,
  getAllActivityTypes, createActivityType, getBlobMeta, activityBlobFilename,
} from "../../api/fileActivity";
import { getFileLogs, getOpenFileLogs, createFileLog, closeFileLog, updateFileLog, deleteFileLog } from "../../api/fileLogs";
import { getSales, getLineItems } from "../../api/sales";
import { getPurchaseById } from "../../api/purchases";
import { getPurchaseItemsByRef } from "../../api/purchaseItems";
import { getCustomers, getContacts } from "../../api/party";
import { getMatpassById, printMatpassPDF, buildMatpassBlobUrl } from "../../api/matpass";
import { getStockItems } from "../../api/stocks";
import { printInvoice, buildInvoiceBlobUrl } from "../../components/admin/PDFTemplates";
import DatePicker from "./DatePicker";
import StatusBadge from "./StatusBadge";
import BlobViewer from "./BlobViewer";
import { downloadBlob } from "../../hooks/useAuthBlob";
import {
  PAGE_SIZE, canEdit, canDelete, canAdd,
  fmtDate, localDate, toISODate, toSortableDate,
  iconBtn, labelStyle, inputStyle, editCardStyle,
} from "./shared/adminStyles";
import { TableScroller, Pagination, ConfirmDelete } from "./shared/AdminTable";
import { useToast } from "./shared/ToastContext";
import Btn from "./shared/Btn";
import ActivityTypeModal from "./activitylog/ActivityTypeModal";
import { purchaseDoctypeLabel, emptyActForm, expiryFlag } from "./activitylog/activityLogConstants";
import CreateLinkModal from "./files/CreateLinkModal";
import DescriptionCell from "./activitylog/DescriptionCell";
import DescriptionDetail from "./activitylog/DescriptionDetail";
import YesNoRadio from "./activitylog/YesNoRadio";
import {
  fileKindOf, isChainLinked, unclaimedConnectable,
  deleteActLabel, linkedActLabel, linkedActState,
  MAX_FILE_SIZE_MB, MAX_FILE_SIZE_BYTES,
} from "./activitylog/activityHelpers";

export default function ActivityLog({ role = "COMMON" }) {
  const toast = useToast();
  const queryClient = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────
const { data: files = [], isLoading: fileLoading, isError: fileError } = useQuery({
    queryKey: ["files"],
    queryFn: () => getFiles().then((data) =>
      [...data].sort((a, b) => {
        const diff = toSortableDate(b.date) - toSortableDate(a.date);
        return diff !== 0 ? diff : (b.fileId ?? 0) - (a.fileId ?? 0);
      })
    ),
  });

  const { data: activityTypes = [], refetch: refreshActivityTypes } = useQuery({
    queryKey: ["activityTypes"],
    queryFn: getAllActivityTypes,
  });
  const [openFile, setOpenFile] = useState(null);   // ← moved up here
const { data: fileActs = [], isLoading: fileActLoading, isError: fileActError } = useQuery({
    queryKey: ["activities", openFile?.fileId],
    queryFn:  () => getActivities(openFile.fileId),
    enabled:  !!openFile?.fileId,
    select:   (acts) => [...acts].sort((a, b) => {
      const diff = toSortableDate(b.date) - toSortableDate(a.date);
      return diff !== 0 ? diff : (b.id ?? 0) - (a.id ?? 0);
    }),
  });

  // ── File-log chain queries (cause/effect dropdowns + history panel) ──
  const { data: openFileLogs = [] } = useQuery({
    queryKey: ["fileLogsOpen", openFile?.fileId],
    queryFn:  () => getOpenFileLogs(openFile.fileId),
    enabled:  !!openFile?.fileId,
  });
  const { data: fileLogHistory = [], isLoading: fileLogLoading } = useQuery({
    queryKey: ["fileLogs", openFile?.fileId],
    queryFn:  () => getFileLogs(openFile.fileId),
    enabled:  !!openFile?.fileId,
    select:   (rows) => [...rows].sort((a, b) => (b.id ?? 0) - (a.id ?? 0)), // newest first
  });

  // ── Blob metadata (real file name + type) for every activity's attached
  // file, so the S.No & File / Linked File cells can show an actual name
  // and a colored file-type icon instead of a raw blob id.               ──
  const uniqueBlobIds = [...new Set(fileActs.map((a) => a.blobId).filter(Boolean))];
  const blobMetaQueries = useQueries({
    queries: uniqueBlobIds.map((blobId) => ({
      queryKey: ["blobMeta", blobId],
      queryFn:  () => getBlobMeta(blobId),
      enabled:  !!blobId,
      staleTime: 5 * 60 * 1000,
    })),
  });
  const blobMetaByBlobId = {};
  uniqueBlobIds.forEach((blobId, i) => { blobMetaByBlobId[blobId] = blobMetaQueries[i]?.data || null; });
  const actById = {};
  fileActs.forEach((a) => { actById[a.id] = a; });

  // ── Close a log entry — automatic, no password required ────────
  const [closingId, setClosingId] = useState(null); // log id currently being closed (disables its button)

  const handleCloseLog = async (log) => {
    setClosingId(log.id);
    try {
      await closeFileLog(log.id);
      await queryClient.invalidateQueries({ queryKey: ["fileLogs", openFile.fileId] });
      await queryClient.invalidateQueries({ queryKey: ["fileLogsOpen", openFile.fileId] });
    } catch (e) {
      toast.error(e.message || "Failed to close activity.");
    } finally {
      setClosingId(null);
    }
  };

  // ── File-level state ─────────────────────────────────────────
  const [editingFile, setEditingFile]   = useState(null);
  const [editFileForm, setEditFileForm] = useState({});
  const [showAddFile, setShowAddFile]   = useState(false);
  const [addFileForm, setAddFileForm]   = useState({
    fileId: "", activity: "", subject: "", description: "", date: localDate(), status: "ACTIVE",
  });
  const [fileSaving, setFileSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  // Holds the fileId currently being exported, so only that row's button
  // shows a loading state (multiple rows can't export at once, but any
  // row can be exported independently of the "Export" (all) button above).
  const [exportingFileId, setExportingFileId] = useState(null);

  const handleExportAll = async () => {
    setExporting(true);
    try {
      await exportAll();
    } catch (e) {
      toast.error(e.message || "Export failed.");
    } finally {
      setExporting(false);
    }
  };

  const handleExportFile = async (fileId) => {
    setExportingFileId(fileId);
    try {
      await exportFile(fileId);
    } catch (e) {
      toast.error(e.message || "Export failed.");
    } finally {
      setExportingFileId(null);
    }
  };
  const [filePage, setFilePage]     = useState(1);
  const [showActTypeModal, setShowActTypeModal] = useState(false);

  // ── Drill-down state ─────────────────────────────────────────
  const [detailAct, setDetailAct]   = useState(null);

  // ── Activity-level state ─────────────────────────────────────
  const [showAddAct, setShowAddAct]       = useState(false);
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [addActForm, setAddActForm]       = useState(emptyActForm());
  const [addActFile, setAddActFile]       = useState(null);
  const [actSaving, setActSaving]         = useState(false);
  const [editingAct, setEditingAct]       = useState(null);
  const [editActForm, setEditActForm]     = useState({});
  const [editActFile, setEditActFile]     = useState(null);
  const [actPage, setActPage]             = useState(1);
  const addActFileRef  = useRef(null);
  const editActFileRef = useRef(null);

  // ── One Yes/No toggle for the Cause ID / Effect ID pickers on the New
  // Activity form — a lot of activities are single, standalone uploads
  // with no chain at all, so both dropdowns stay hidden together until
  // the user says "Yes" they want to link this to another activity.
  const [hasChain, setHasChain] = useState(false);
  const [editHasChain, setEditHasChain] = useState(false);

  // ── "End of chain" checkbox — when checked, this activity closes the
  // loop, so no further follow-up is expected and Expire Date is not
  // required (it's cleared and hidden while checked).
  const [endsChain, setEndsChain] = useState(false);

  // ── Inline "quick-add" activity type (in file add/edit form) ─
  const [showNewActivityInput, setShowNewActivityInput] = useState(false);
  const [newActivityName, setNewActivityName]           = useState("");
  const [addingActivityType, setAddingActivityType]     = useState(false);

  // ── Misc UI state ────────────────────────────────────────────
  const [lightbox, setLightbox]         = useState(null);
  const [confirmKey, setConfirmKey]     = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(new Set());
  const [genDocUrl, setGenDocUrl]       = useState(null);
  const [genDocLoading, setGenDocLoading] = useState(false);

  // ── Inline validation errors ─────────────────────────────────
  const [addFileErrors, setAddFileErrors]   = useState({});
  const [editFileErrors, setEditFileErrors] = useState({});
  const [addActErrors, setAddActErrors]     = useState({});
  const [editActErrors, setEditActErrors]   = useState({});

  const FieldError = ({ msg }) => msg
    ? <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "#ef4444", display: "flex", alignItems: "center", gap: 4 }}>
        <span>⚠</span> {msg}
      </p>
    : null;

  const errBorder = (hasErr) => hasErr
    ? { outline: "1.5px solid #ef4444", border: "1px solid #ef4444" }
    : {};

  // Revoke generated blob URL on change/unmount
  useEffect(() => {
    return () => { if (genDocUrl) URL.revokeObjectURL(genDocUrl); };
  }, [genDocUrl]);

  // ── Inline quick-add activity type ───────────────────────────
  const handleCreateActivityType = async () => {
    if (!newActivityName.trim()) return;
    setAddingActivityType(true);
    try {
      await createActivityType(newActivityName.trim());
      await refreshActivityTypes();
      setAddFileForm((p) => ({ ...p, activity: newActivityName.trim() }));
      setEditFileForm((p) => ({ ...p, activity: newActivityName.trim() }));
      setAddFileErrors((p) => ({ ...p, activity: "" }));
      setNewActivityName("");
      setShowNewActivityInput(false);
    } catch (e) {
      toast.error(e.message || "Failed to add activity type.");
    } finally {
      setAddingActivityType(false);
    }
  };

  // ── File CRUD ─────────────────────────────────────────────────
  const handleAddFile = async () => {
    const { activity, subject, date, description } = addFileForm;
    const errs = {};
    if (!activity) errs.activity = "Please select an activity type.";
    if (!subject?.trim()) errs.subject = "Subject is required.";
    if (!date) errs.date = "Date is required (e.g. 28-06-2027).";
    if (!description?.trim()) errs.description = "Description is required.";
    if (Object.keys(errs).length) { setAddFileErrors(errs); return; }
    setAddFileErrors({});
    setFileSaving(true);
    try {
      const { fileId: _unused, ...payload } = addFileForm;
      await createFile(payload);
      await queryClient.invalidateQueries({ queryKey: ["files"] });
      setShowAddFile(false);
      setAddFileForm({ fileId: "", activity: "", subject: "", description: "", date: localDate(), status: "ACTIVE" });
      setAddFileErrors({});
      setFilePage(1);
    } catch (e) {
      toast.error(e.message || "Failed to add.");
    } finally {
      setFileSaving(false);
    }
  };

  const handleEditFile = async (fileId) => {
    const { activity, subject, date, description } = editFileForm;
    const errs = {};
    if (!activity) errs.activity = "Please select an activity type.";
    if (!subject?.trim()) errs.subject = "Subject is required.";
    if (!date) errs.date = "Date is required (e.g. 28-06-2027).";
    if (!description?.trim()) errs.description = "Description is required.";
    if (Object.keys(errs).length) { setEditFileErrors(errs); return; }
    setEditFileErrors({});
    setFileSaving(true);
    try {
      await updateFile(fileId, editFileForm);
      await queryClient.invalidateQueries({ queryKey: ["files"] });
      setEditingFile(null);
      setEditFileErrors({});
    } catch {
      toast.error("Failed to save.");
    } finally {
      setFileSaving(false);
    }
  };

  const handleDeleteFile = async (fileId) => {
    try {
      await deleteFile(fileId);
      await queryClient.invalidateQueries({ queryKey: ["files"] });
    } catch {
      toast.error("Failed to delete.");
    }
  };

  const openFileDetail = async (file) => {
    setOpenFile(file);
    setShowAddAct(false);
    setLightbox(null); setDetailAct(null); setActPage(1);
  };

  const backToFiles = () => {
    setOpenFile(null); setLightbox(null); setDetailAct(null); setShowCreateLink(false);
    if (genDocUrl) { URL.revokeObjectURL(genDocUrl); setGenDocUrl(null); }
  };

  // ── Open activity detail with its chain/log data merged in ────
  // `act` alone only has the activity's own fields (date, description,
  // attachment). Expire date, log description, and chain status live on the
  // matching logs_file_activities row — merge it in so the detail page can
  // show everything that was entered on the New Activity form.
  const openActDetail = (act) => {
    const log = fileLogHistory.find((l) => String(l.currentId) === String(act.id));
    setDetailAct({
      ...act,
      logDescription: log?.logDescription ?? "",
      expireDate:     log?.expireDate ?? "",
      logStatus:      log?.logStatus ?? null,
      causeId:        log?.causeId ?? null,
      effectId:       log?.effectId ?? null,
    });
  };

  // ── Activity CRUD ────────────────────────────────────────────
  const handleAddAct = async () => {
    const errs = {};
    if (!addActForm.date) errs.date = "Date is required (e.g. 28-06-2027).";
    if (!addActForm.description?.trim()) errs.description = "Description is required.";
    if (hasChain) {
      if (!endsChain && !addActForm.expireDate) errs.expireDate = "Expire date is required.";
      if (!addActForm.logDescription?.trim()) errs.logDescription = "Log description is required.";

      // Multiple open activities are allowed on a file at once. Picking
      // Null on Continues From just starts another standalone open item —
      // it does NOT need to close whatever's already open. If the user
      // actually wants to close a prior open activity, that's a deliberate
      // choice made via "This ends the loop / chain" (or by explicitly
      // picking it under Also Closes) — never forced automatically here.
    }
    if (addActForm.causeId && addActForm.effectId && addActForm.causeId === addActForm.effectId) {
      errs.effectId = "Cause and Effect must be different activities.";
    }
    if (Object.keys(errs).length) { setAddActErrors(errs); return; }
    setAddActErrors({});
    setActSaving(true);
    let newActivity = null;
    try {
      newActivity = await createActivity(openFile.fileId, addActForm, addActFile);
      // current_id for the new log row is always the id of the activity we
      // just created — the user never sets this directly.
      const newLog = await createFileLog({
        fileRefId:      openFile.fileId,
        currentId:      newActivity.id,
        causeId:        addActForm.causeId || null,
        effectId:       addActForm.effectId || null,
        logDate:        addActForm.date,
        expireDate:     addActForm.expireDate,
        logDescription: addActForm.logDescription,
        // YES creates an OPEN (green) chain entry. NO creates a SINGLE
        // (yellow) activity. A deleted/unlinked chain is also reset to
        // SINGLE by the backend while preserving its log description.
        logStatus: hasChain ? "open" : "single",
      });

      // "This ends the loop / chain" — close this brand-new log entry.
      // Note: if a Continues From (causeId) was picked, the backend has
      // already closed THAT row automatically as part of the createFileLog
      // request above (see logs.php) — closing it again here would 409
      // ("already closed"), so we only need to close the new row itself.
      if (endsChain) {
        try {
          await closeFileLog(newLog.id);
        } catch (e) {
          // The activity + log were saved successfully; only the auto-close
          // step failed, so surface it without rolling anything back.
          toast.error(e.message || "Activity saved, but automatic closing failed.");
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["activities", openFile.fileId] });
      await queryClient.invalidateQueries({ queryKey: ["fileLogs", openFile.fileId] });
      await queryClient.invalidateQueries({ queryKey: ["fileLogsOpen", openFile.fileId] });
      setShowAddAct(false); setAddActForm(emptyActForm()); setAddActFile(null); setAddActErrors({}); setActPage(1); setHasChain(false); setEndsChain(false);
    } catch (e) {
      // The activity itself was created but the log entry failed to link —
      // roll it back so the two never drift apart.
      if (newActivity?.id) {
        await deleteActivity(newActivity.id, newActivity.blobId).catch(() => {});
        await queryClient.invalidateQueries({ queryKey: ["activities", openFile.fileId] });
      }
      toast.error(e.message || "Failed to add activity.");
    } finally {
      setActSaving(false);
    }
  };

  const handleEditAct = async (id) => {
    const errs = {};
    if (!editActForm.date) errs.date = "Date is required (e.g. 28-06-2027).";
    if (!editActForm.description?.trim()) errs.description = "Description is required.";
    // editHasChain is derived from the activity's existing log row when the
    // edit form opens (see setEditingAct calls below) — it's no longer a
    // user-facing toggle, so this just means "this activity is already
    // part of a chain," in which case Log Description stays required the
    // same way it was when the activity was first created.
    if (editHasChain && !editActForm.logDescription?.trim()) {
      errs.logDescription = "Log description is required.";
    }
    if (Object.keys(errs).length) { setEditActErrors(errs); return; }
    setEditActErrors({});
    setActSaving(true);
    try {
      await updateActivity(id, { ...editActForm, fileId: openFile.fileId }, editActFile);
      // Expire Date and Log Description live on the file-log entry, not the
      // activity itself — save them there too if this activity is part of
      // a chain. Expire Date is optional (blank just clears the expiry
      // badge); Log Description is required for chain activities, enforced
      // above.
      const log = fileLogHistory.find((l) => String(l.currentId) === String(id));
      if (log) {
        await updateFileLog(log.id, {
          expireDate: editActForm.expireDate ?? "",
          logDescription: editActForm.logDescription ?? "",
        });
      }
      await queryClient.invalidateQueries({ queryKey: ["activities", openFile.fileId] });
      await queryClient.invalidateQueries({ queryKey: ["fileLogs", openFile.fileId] });
      await queryClient.invalidateQueries({ queryKey: ["fileLogsOpen", openFile.fileId] });
      setEditingAct(null); setEditActFile(null); setEditActErrors({}); setEditHasChain(false);
    } catch {
      toast.error("Failed to save.");
    } finally {
      setActSaving(false);
    }
  };

  const handleDeleteAct = async (act) => {
    try {
      // Delete/unlink the chain (file-log) entry FIRST, if this activity
      // has one. The backend decides which of two things happens:
      //  - chainBroken: false → plain standalone entry, soft-deleted as usual.
      //    We then also delete the actual activity/file below.
      //  - chainBroken: true  → this activity was part of a chain. NOTHING
      //    was deleted server-side — only the chain links were removed and
      //    every linked activity (this one included) is now a standalone
      //    entry. The activity/file itself must be left alone in that case.
      const log = fileLogHistory.find((l) => String(l.currentId) === String(act.id));
      let chainBroken = false;
      if (log) {
        const result = await deleteFileLog(log.id);
        chainBroken = !!result?.chainBroken;
      }

      if (chainBroken) {
        toast.success(chainUnlinkedMessage());
      } else {
        await deleteActivity(act.id, act.blobId);
        if (lightbox?.blobId === act.blobId) setLightbox(null);
      }

      await queryClient.invalidateQueries({ queryKey: ["activities", openFile.fileId] });
      await queryClient.invalidateQueries({ queryKey: ["fileLogs", openFile.fileId] });
      await queryClient.invalidateQueries({ queryKey: ["fileLogsOpen", openFile.fileId] });
      if (detailAct?.id === act.id) setDetailAct(null);
    } catch (e) {
      toast.error(e.message || "Failed to delete.");
    }
  };

  // Toast copy shown after a chain-delete turns out to be an unlink instead
  // of a real delete, so the user understands nothing was actually removed.
  function chainUnlinkedMessage() {
    return "This activity was part of a chain — the chain has been unlinked and every linked activity is now standalone. No files were deleted.";
  }

  // ── Document preview helpers ─────────────────────────────────
  const handleViewInvoice = async (act) => {
    const { saleId, purchaseId } = act;
    if (!saleId && !purchaseId) return;
    setGenDocLoading(true);
    setGenDocUrl(null);
    try {
      const customers = await getCustomers();
      if (saleId) {
        const [allSales, items] = await Promise.all([getSales(), getLineItems(saleId)]);
        const sale = allSales.find((s) => s.id === saleId);
        if (!sale) { toast.error("Sale record not found."); return; }
        let contactName = sale.addressedTo;
        if (sale.addressedTo && sale.toParty) {
          try {
            const contacts = await getContacts(sale.toParty);
            const c = contacts.find((c) => String(c.id) === String(sale.addressedTo));
            if (c) contactName = c.name;
          } catch { /* use raw id */ }
        }
        const toParty = customers.find((c) => String(c.id) === String(sale.toParty)) || {};
        setGenDocUrl(buildInvoiceBlobUrl({
          docType: sale.documentType, refNo: String(sale.id),
          date: sale.date, validity: sale.validity, currency: sale.currency,
          toParty, contactName,
          paymentTerms: sale.paymentTerms, deliveryTerms: sale.deliveryTerms,
          description: sale.description, items,
        }));
      } else {
        const purchase = await getPurchaseById(purchaseId);
        const items = await getPurchaseItemsByRef(purchase.purchaseFileRef);
        let contactName = purchase.purchaseAddressedTo;
        if (purchase.purchaseAddressedTo && purchase.purchaseToParty) {
          try {
            const contacts = await getContacts(purchase.purchaseToParty);
            const c = contacts.find((c) => String(c.id) === String(purchase.purchaseAddressedTo));
            if (c) contactName = c.name;
          } catch { /* use raw id */ }
        }
        const toParty = customers.find((c) => String(c.id) === String(purchase.purchaseToParty)) || {};
        setGenDocUrl(buildInvoiceBlobUrl({
          docType: purchaseDoctypeLabel(purchase.purchaseDoctype),
          refNo: String(purchase.id),
          date: purchase.purchaseDate, validity: purchase.purchaseValidity,
          currency: purchase.purchaseCurrency, toParty, contactName,
          paymentTerms: purchase.purchasePaymentTerms,
          deliveryTerms: purchase.purchaseDeliveryTerms,
          description: purchase.purchaseDescription, items,
        }));
      }
    } catch (e) {
      toast.error(`Preview error: ${e.message}`);
    } finally {
      setGenDocLoading(false);
    }
  };

  const handleViewMatpassPDF = async (act) => {
    if (!act.matpassId) return;
    setGenDocLoading(true);
    setGenDocUrl(null);
    try {
      const [matpass, customers, stockItems] = await Promise.all([
        getMatpassById(act.matpassId), getCustomers(), getStockItems(),
      ]);
      const url = await buildMatpassBlobUrl({ row: matpass, customers, stockItems, toast });
      if (url) setGenDocUrl(url);
    } catch (e) {
      toast.error(`Preview error: ${e.message}`);
    } finally {
      setGenDocLoading(false);
    }
  };

  // ── Document print helpers ───────────────────────────────────
  const handleInvoice = async (act) => {
    const { saleId, purchaseId } = act;
    if (!saleId && !purchaseId) return;
    setInvoiceLoading((prev) => new Set([...prev, act.id]));
    try {
      const customers = await getCustomers();
      if (saleId) {
        const [allSales, items] = await Promise.all([getSales(), getLineItems(saleId)]);
        const sale = allSales.find((s) => s.id === saleId);
        if (!sale) { toast.error("Sale record not found."); return; }
        let contactName = sale.addressedTo;
        if (sale.addressedTo && sale.toParty) {
          try {
            const contacts = await getContacts(sale.toParty);
            const c = contacts.find((c) => String(c.id) === String(sale.addressedTo));
            if (c) contactName = c.name;
          } catch { /* use raw id */ }
        }
        const toParty = customers.find((c) => String(c.id) === String(sale.toParty)) || {};
        printInvoice({
          docType: sale.documentType, refNo: String(sale.id),
          date: sale.date, validity: sale.validity, currency: sale.currency,
          toParty, contactName,
          paymentTerms: sale.paymentTerms, deliveryTerms: sale.deliveryTerms,
          description: sale.description, items,
        });
      } else {
        const purchase = await getPurchaseById(purchaseId);
        const items = await getPurchaseItemsByRef(purchase.purchaseFileRef);
        let contactName = purchase.purchaseAddressedTo;
        if (purchase.purchaseAddressedTo && purchase.purchaseToParty) {
          try {
            const contacts = await getContacts(purchase.purchaseToParty);
            const c = contacts.find((c) => String(c.id) === String(purchase.purchaseAddressedTo));
            if (c) contactName = c.name;
          } catch { /* use raw id */ }
        }
        const toParty = customers.find((c) => String(c.id) === String(purchase.purchaseToParty)) || {};
        printInvoice({
          docType: purchaseDoctypeLabel(purchase.purchaseDoctype),
          refNo: String(purchase.id),
          date: purchase.purchaseDate, validity: purchase.purchaseValidity,
          currency: purchase.purchaseCurrency, toParty, contactName,
          paymentTerms: purchase.purchasePaymentTerms,
          deliveryTerms: purchase.purchaseDeliveryTerms,
          description: purchase.purchaseDescription, items,
        });
      }
    } catch (e) {
      toast.error(`Invoice error: ${e.message}`);
    } finally {
      setInvoiceLoading((prev) => { const s = new Set(prev); s.delete(act.id); return s; });
    }
  };

  const handleMatpassPDF = async (act) => {
    if (!act.matpassId) return;
    setInvoiceLoading((prev) => new Set([...prev, act.id]));
    try {
      const [matpass, customers, stockItems] = await Promise.all([
        getMatpassById(act.matpassId), getCustomers(), getStockItems(),
      ]);
      await printMatpassPDF({ row: matpass, customers, stockItems, toast });
    } catch (e) {
      toast.error(`Matpass PDF error: ${e.message}`);
    } finally {
      setInvoiceLoading((prev) => { const s = new Set(prev); s.delete(act.id); return s; });
    }
  };

  // ── Lightbox modal ───────────────────────────────────────────
  const FileModal = () => !lightbox ? null : (
    <div className="lightbox-overlay" onClick={() => setLightbox(null)}>
      <div className="lightbox-box" onClick={(e) => e.stopPropagation()}>
        <div className="lightbox-header">
          <span className="lightbox-name">{lightbox.name}</span>
          <div style={{ display: "flex", gap: 8 }}>
            {lightbox.blobId && (
              <button className="detail-download-btn"
                onClick={() => downloadBlob(lightbox.blobId, lightbox.name).catch((e) => toast.error(e.message))}>
                ⬇ Download
              </button>
            )}
            <button className="lightbox-close" onClick={() => setLightbox(null)}>✕</button>
          </div>
        </div>
        <div style={{ flex: 1, overflow: "auto", display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <BlobViewer blobId={lightbox.blobId} fileType={lightbox.fileType} filename={lightbox.name}
            className={lightbox.fileType?.startsWith("image/") ? "lightbox-img" : "lightbox-pdf"}
            showDownloadButton={false} />
        </div>
      </div>
    </div>
  );

  // ── Activity dropdown options (from DB only) ─────────────────
  const activityDropdownOptions = activityTypes
    .map((t) => t.name)
    .sort((a, b) => a.localeCompare(b));

  // ── Activity type dropdown + quick-add (reused in add & edit forms) ───────
  const ActivityTypeField = ({ value, onChange, errors, setErrors }) => (
    <div>
      <label style={labelStyle}>Activity *</label>
      <div style={{ display: "flex", gap: 6, alignItems: "flex-start" }}>
        {showNewActivityInput ? (
          <>
            <input
              className="activity-input"
              style={{ ...inputStyle, flex: 1 }}
              placeholder="New activity type name…"
              value={newActivityName}
              autoFocus
              onChange={(e) => setNewActivityName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateActivityType();
                if (e.key === "Escape") { setShowNewActivityInput(false); setNewActivityName(""); }
              }}
            />
            <button className="act-btn act-save" style={{ padding: "0 10px", whiteSpace: "nowrap", fontSize: "0.78rem", height: 36 }}
              onClick={handleCreateActivityType} disabled={addingActivityType || !newActivityName.trim()}>
              {addingActivityType ? "…" : "✓"}
            </button>
            <button className="act-btn act-cancel" style={{ padding: "0 10px", height: 36 }}
              onClick={() => { setShowNewActivityInput(false); setNewActivityName(""); }}>✕</button>
          </>
        ) : (
          <>
            <select
              className="activity-input"
              style={{ ...inputStyle, flex: 1, ...errBorder(errors?.activity) }}
              value={value}
              onChange={(e) => { onChange(e.target.value); setErrors?.((p) => ({ ...p, activity: "" })); }}
            >
              <option value="">— Select activity type —</option>
              {activityDropdownOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            {role === "SUPER" && (
              <button title="Add new activity type" className="act-btn act-save"
                style={{ padding: "0 12px", height: 36, flexShrink: 0, fontSize: "1.1rem", lineHeight: 1 }}
                onClick={() => { setShowActTypeModal(true); setShowNewActivityInput(false); setNewActivityName(""); }}>
                +
              </button>
            )}
          </>
        )}
      </div>
      <FieldError msg={errors?.activity} />
    </div>
  );

  // ── Level 2: Activity detail ──────────────────────────────────
  if (openFile && detailAct) {
    return (
      <div className="content-section">
        <div className="activity-header">
          <div className="act-breadcrumb">
            <Btn variant="back" icon="←" onClick={() => { setDetailAct(null); if (genDocUrl) { URL.revokeObjectURL(genDocUrl); setGenDocUrl(null); } }}>← Activities</Btn>
            <span className="act-breadcrumb-label">
              / <strong>{openFile.activity}</strong> — Activity #{detailAct.id}
            </span>
          </div>
          {canEdit(role) && (
            <div style={{ display: "flex", gap: 6 }}>
              {(detailAct.saleId || detailAct.purchaseId) && (
                <button style={iconBtn("var(--a-teal)", "var(--a-teal-05)", "var(--a-teal-20)")}
                  title="Generate Invoice" onClick={() => handleInvoice(detailAct)}
                  disabled={invoiceLoading.has(detailAct.id)}>
                  {invoiceLoading.has(detailAct.id) ? "⏳" : "🖨️"}
                </button>
              )}
              {detailAct.matpassId && (
                <button style={iconBtn("var(--a-teal)", "var(--a-teal-05)", "var(--a-teal-20)")}
                  title="Download MAT Pass PDF" onClick={() => handleMatpassPDF(detailAct)}
                  disabled={invoiceLoading.has(detailAct.id)}>
                  {invoiceLoading.has(detailAct.id) ? "⏳" : "📄"}
                </button>
              )}
              <button title="Edit"
                style={iconBtn("var(--a-indigo,#6366f1)", "var(--a-indigo-10,rgba(99,102,241,0.1))", "var(--a-indigo-30,rgba(99,102,241,0.3))")}
                onClick={() => { setDetailAct(null); setEditingAct(detailAct.id); setEditActForm({ date: toISODate(detailAct.date), status: detailAct.status, description: detailAct.description, blobId: detailAct.blobId, expireDate: detailAct.expireDate ? toISODate(detailAct.expireDate) : "", logDescription: detailAct.logDescription ?? "" }); setEditHasChain(!!(detailAct.expireDate || detailAct.causeId || detailAct.effectId || detailAct.logDescription)); }}>
                ✏️
              </button>
              {canDelete(role) && (
                confirmKey === `act-${detailAct.id}` ? (
                  <ConfirmDelete
                    label={deleteActLabel(detailAct, fileLogHistory)}
                    onConfirm={() => { setConfirmKey(null); handleDeleteAct(detailAct); setDetailAct(null); }}
                    onCancel={() => setConfirmKey(null)}
                  />
                ) : (
                  <button title="Delete"
                    style={iconBtn("var(--a-danger,#ef4444)", "var(--a-danger-10,rgba(239,68,68,0.1))", "var(--a-danger-30,rgba(239,68,68,0.3))")}
                    onClick={() => setConfirmKey(`act-${detailAct.id}`)}>🗑️</button>
                )
              )}
            </div>
          )}
        </div>

        {/* Detail card */}
        <div style={{
          background: "var(--a-surface, #fff)",
          border: "1px solid var(--a-border-card, rgba(20,184,166,0.2))",
          borderRadius: 14, overflow: "hidden", marginBottom: 20,
          boxShadow: "0 2px 12px rgba(0,0,0,0.05)",
        }}>
          <div style={{
            background: "linear-gradient(135deg, var(--a-teal-15,rgba(20,184,166,0.15)), var(--a-teal-08,rgba(20,184,166,0.08)))",
            borderBottom: "1px solid var(--a-border-card, rgba(20,184,166,0.2))",
            padding: "20px 28px",
            display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12,
          }}>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "var(--a-teal)", marginBottom: 4 }}>
                Activity Detail
              </div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 600, color: "var(--a-text, #0f172a)" }}>
                #{detailAct.id} — {fmtDate(detailAct.date)}
              </h2>
            </div>
            {(detailAct.saleId || detailAct.purchaseId || detailAct.matpassId) && (
              <span style={{
                background: "var(--a-teal-15)", color: "var(--a-teal)",
                border: "1px solid var(--a-teal-30)", borderRadius: 20,
                padding: "4px 14px", fontWeight: 700, fontSize: "0.85rem", letterSpacing: "0.04em",
              }}>
                {detailAct.saleId ?? detailAct.purchaseId ?? detailAct.matpassId}
              </span>
            )}
          </div>

          <div style={{
            display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 0, borderBottom: "1px solid var(--a-border-card, rgba(20,184,166,0.15))",
          }}>
            {[
              { label: "Date", value: fmtDate(detailAct.date), icon: "📅" },
              detailAct.logStatus && {
                label: "Chain Status", icon: "🔗",
                value: detailAct.logStatus === "open"
                  ? "Open"
                  : detailAct.logStatus === "closed"
                  ? "Closed"
                  : "Single",
              },
              detailAct.expireDate && {
                label: "Expire Date", icon: "⏰",
                value: (() => {
                  const flag = expiryFlag(detailAct.expireDate);
                  return (
                    <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      {fmtDate(detailAct.expireDate)}
                      {flag && (
                        <span style={{
                          fontSize: "0.68rem", fontWeight: 700, padding: "1px 8px", borderRadius: 10,
                          color: "#f59e0b", border: "1px solid rgba(245,158,11,0.35)", background: "rgba(245,158,11,0.08)",
                        }}>
                          {flag === "expired" ? "⚠ Expired" : "⏰ Expiring soon"}
                        </span>
                      )}
                    </span>
                  );
                })(),
              },
              {
                label: "Closed Action", icon: "⬅️",
                value: detailAct.causeId ? (
                  <span className={`act-pill act-pill-${linkedActState(detailAct.causeId, { fileLogHistory })}`}
                    style={{ textTransform: "none", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", verticalAlign: "bottom" }}
                    title={linkedActLabel(detailAct.causeId, { actById, blobMetaByBlobId, fileLogHistory })}>
                    {linkedActLabel(detailAct.causeId, { actById, blobMetaByBlobId, fileLogHistory })}
                  </span>
                ) : "None",
              },
              {
                label: "Follow Up Action", icon: "➡️",
                value: (detailAct.effectId && String(detailAct.effectId) !== String(detailAct.id)) ? (
                  <span className={`act-pill act-pill-${linkedActState(detailAct.effectId, { fileLogHistory })}`}
                    style={{ textTransform: "none", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis", display: "inline-block", verticalAlign: "bottom" }}
                    title={linkedActLabel(detailAct.effectId, { actById, blobMetaByBlobId, fileLogHistory })}>
                    {linkedActLabel(detailAct.effectId, { actById, blobMetaByBlobId, fileLogHistory })}
                  </span>
                ) : "None",
              },
            ].filter(Boolean).map(({ label, value, icon }) => (
              <div key={label} style={{ padding: "16px 28px", borderRight: "1px solid var(--a-border-card, rgba(20,184,166,0.1))", minWidth: 0, overflow: "hidden" }}>
                <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--a-text-faint, #64748b)", marginBottom: 6 }}>
                  {icon} {label}
                </div>
                <div style={{ fontWeight: 600, fontSize: "0.95rem", color: "var(--a-text, #0f172a)" }}>{value}</div>
              </div>
            ))}
          </div>

          <DescriptionDetail text={detailAct.description} />
          {detailAct.logDescription && (
            <div style={{ padding: "0 28px 20px" }}>
              <div style={{ fontSize: "0.68rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "var(--a-text-faint, #64748b)", marginBottom: 10 }}>
                🧾 Log Description
              </div>
              <div style={{
                background: "var(--a-teal-05, rgba(20,184,166,0.04))",
                border: "1px solid var(--a-teal-10, rgba(20,184,166,0.1))",
                borderRadius: 8, padding: "14px 18px",
                color: "var(--a-text-body, #1e293b)", fontSize: "0.95rem",
                whiteSpace: "pre-wrap", wordBreak: "break-word",
              }}>
                {detailAct.logDescription}
              </div>
            </div>
          )}
        </div>

        {/* Attached file card */}
        <div className="detail-file-card">
          {detailAct.blobId ? (() => {
            const blobMeta = blobMetaByBlobId[detailAct.blobId];
            // detailAct never had a "title" field — it was always undefined,
            // which is why preview detection silently failed for any file
            // whose MIME type alone wasn't specific enough. The real name
            // and type live on the blob's own metadata, keyed by blobId.
            const attachedFileName = blobMeta?.fileName || `activity-${detailAct.id}-file`;
            const attachedFileType = blobMeta?.fileType || detailAct.fileType;
            // Matches the export ZIP's per-activity naming exactly, so a
            // single-activity download and the same file inside an export
            // land with the same name — see activityBlobFilename().
            const downloadFileName = activityBlobFilename(
              detailAct.fileId, detailAct.id, blobMeta?.fileName, attachedFileType,
            );
            return (
              <>
                <div className="detail-file-header">
                  <h3 className="detail-file-heading">📎 Attached File</h3>
                  <button className="detail-download-btn"
                    onClick={() => downloadBlob(detailAct.blobId, downloadFileName).catch((e) => toast.error(e.message))}>
                    ⬇ Download
                  </button>
                </div>
                <BlobViewer blobId={detailAct.blobId} fileType={attachedFileType} filename={attachedFileName}
                  showDownloadButton={false} />
              </>
            );
          })() : (detailAct.saleId || detailAct.purchaseId) ? (
            <>
              <div className="detail-file-header">
                <h3 className="detail-file-heading">🖨️ Generated Document</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  {genDocUrl && <Btn variant="ghost" onClick={() => handleInvoice(detailAct)} disabled={invoiceLoading.has(detailAct.id)} icon="🖨️">Print</Btn>}
                  {genDocUrl && <Btn variant="ghost" onClick={() => { URL.revokeObjectURL(genDocUrl); setGenDocUrl(null); }} icon="✕">Close</Btn>}
                </div>
              </div>
              {genDocUrl ? (
                <iframe src={genDocUrl} title="Invoice Preview" className="detail-file-iframe" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "36px 20px", color: "var(--a-text-faint)" }}>
                  <span style={{ fontSize: "0.9rem" }}>This activity has an auto-generated {detailAct.saleId ? "Sales" : "Purchase"} document.</span>
                  <Btn variant="primary" onClick={() => handleViewInvoice(detailAct)} disabled={genDocLoading} icon="📄">
                    {genDocLoading ? "⏳ Loading..." : "View Document"}
                  </Btn>
                </div>
              )}
            </>
          ) : detailAct.matpassId ? (
            <>
              <div className="detail-file-header">
                <h3 className="detail-file-heading">📄 Generated Document</h3>
                <div style={{ display: "flex", gap: 8 }}>
                  {genDocUrl && <Btn variant="ghost" onClick={() => handleMatpassPDF(detailAct)} disabled={invoiceLoading.has(detailAct.id)} icon="🖨️">Print</Btn>}
                  {genDocUrl && <Btn variant="ghost" onClick={() => { URL.revokeObjectURL(genDocUrl); setGenDocUrl(null); }} icon="✕">Close</Btn>}
                </div>
              </div>
              {genDocUrl ? (
                <iframe src={genDocUrl} title="MAT Pass Preview" className="detail-file-iframe" />
              ) : (
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "36px 20px", color: "var(--a-text-faint)" }}>
                  <span style={{ fontSize: "0.9rem" }}>This activity has an auto-generated MAT Pass document.</span>
                  <Btn variant="primary" onClick={() => handleViewMatpassPDF(detailAct)} disabled={genDocLoading} icon="📄">
                    {genDocLoading ? "⏳ Loading..." : "View Document"}
                  </Btn>
                </div>
              )}
            </>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "22px 28px", color: "var(--a-text-faint)", fontSize: "0.875rem", fontStyle: "italic" }}>
              <span style={{ fontSize: "1.1rem", opacity: 0.5 }}>📎</span>
              No attached file.
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── Level 1: Activity list ────────────────────────────────────
  if (openFile) {
    const pagedActs = fileActs.slice((actPage - 1) * PAGE_SIZE, actPage * PAGE_SIZE);

    // Continues From lists every unclaimed open activity, with an explicit
    // Null option to start a fresh standalone one. Also Closes has been
    // removed from the New Activity form — closing a prior open activity
    // is no longer forced or auto-linked here; if it's ever needed again,
    // it stays available as data on existing logs (see detail/edit views)
    // but isn't part of the add form.
    const causeOptions = unclaimedConnectable(openFileLogs);

    return (
      <div className="content-section">
        <FileModal />
        <div className="activity-header">
          <div className="act-breadcrumb">
            <Btn variant="back" onClick={backToFiles} icon="←">← Files</Btn>
            <span className="act-breadcrumb-label">
              / <strong>{openFile.activity}</strong> — {openFile.subject}
            </span>
          </div>
           {(canAdd(role) || role === "SUPER") && (
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              {role === "SUPER" && (
                <Btn
                  variant="ghost"
                  icon="🔗"
                  onClick={() => {
                    setShowAddAct(false);
                    setShowCreateLink((prev) => !prev);
                  }}
                >
                  {showCreateLink ? "✕ Close" : "+ Create Link"}
                </Btn>
              )}
              {canAdd(role) && (
                <Btn
                  variant="teal"
                  icon="＋"
                  onClick={() => {
                    setShowCreateLink(false);
                    setShowAddAct((prev) => {
                      const next = !prev;
                      if (next) {
                        setAddActForm(emptyActForm());
                        setAddActFile(null);
                        setHasChain(false);
                        setEndsChain(false);
                      }
                      return next;
                    });
                  }}
                >
                  {showAddAct ? "✕ Close" : "+ Add Activity"}
                </Btn>
              )}
            </div>
          )}
        </div>

        {canAdd(role) && (
          <CreateLinkModal
            isOpen={showCreateLink}
            fileId={openFile.fileId}
            fileActivities={fileActs}
            onClose={() => setShowCreateLink(false)}
            onSaved={async () => {
              await queryClient.invalidateQueries({ queryKey: ["fileLogs", openFile.fileId] });
              await queryClient.invalidateQueries({ queryKey: ["fileLogsOpen", openFile.fileId] });
            }}
          />
        )}

        {canAdd(role) && showAddAct && (
          <div style={{ ...editCardStyle, marginBottom: 20 }}>
            <h3 style={{ margin: "0 0 16px", fontSize: "1rem", fontWeight: 700, color: "var(--a-teal)" }}>New Activity</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>
              <div>
                <label style={labelStyle}>Date *</label>
                <div style={{ ...errBorder(addActErrors.date), borderRadius: 6 }}>
                  <DatePicker value={addActForm.date}
                    onChange={(date) => { setAddActForm({ ...addActForm, date }); setAddActErrors((p) => ({ ...p, date: "" })); }} />
                </div>
                <FieldError msg={addActErrors.date} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={labelStyle}>Description *</label>
                <textarea className="activity-input activity-textarea"
                  style={{ ...inputStyle, minHeight: 72, resize: "vertical", ...errBorder(addActErrors.description) }}
                  placeholder="Details..." value={addActForm.description}
                  onChange={(e) => { setAddActForm({ ...addActForm, description: e.target.value }); setAddActErrors((p) => ({ ...p, description: "" })); }} />
                <FieldError msg={addActErrors.description} />
              </div>
              <div style={{ gridColumn: "1/-1" }}>
                <label style={labelStyle}>Link to another activity?</label>
                <YesNoRadio name="hasChain" value={hasChain}
                  onChange={(v) => {
                    setHasChain(v);
                    if (!v) {
                      setEndsChain(false);
                      setAddActForm({ ...addActForm, causeId: "", effectId: "", expireDate: "", logDescription: "" });
                      setAddActErrors((p) => ({ ...p, causeId: "", effectId: "", expireDate: "", logDescription: "" }));
                    }
                  }} />
              </div>

              {hasChain && (
                <>
                  <div style={{ gridColumn: "1/-1", display: "flex", alignItems: "center", gap: 8, margin: "2px 0 4px" }}>
                    <input type="checkbox" id="endsChain" checked={endsChain}
                      style={{ width: 15, height: 15, cursor: "pointer" }}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setEndsChain(checked);
                        if (checked) {
                          setAddActForm((f) => ({ ...f, expireDate: "" }));
                          setAddActErrors((p) => ({ ...p, expireDate: "" }));
                        }
                      }} />
                    <label htmlFor="endsChain" style={{ ...labelStyle, margin: 0, cursor: "pointer" }}>
                      This ends the loop / chain (no expiry date needed)
                    </label>
                  </div>
                  {!endsChain && (
                    <div>
                      <label style={labelStyle}>Expire Date *</label>
                      <div style={{ ...errBorder(addActErrors.expireDate), borderRadius: 6 }}>
                        <DatePicker value={addActForm.expireDate}
                          onChange={(date) => { setAddActForm({ ...addActForm, expireDate: date }); setAddActErrors((p) => ({ ...p, expireDate: "" })); }} />
                      </div>
                      <FieldError msg={addActErrors.expireDate} />
                      <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "var(--a-text-faint)" }}>
                        Shown as a badge once this entry is expiring soon or overdue.
                      </p>
                    </div>
                  )}
                  <div>
                    <label style={labelStyle}>Follow Up Activity</label>
                    <select className="activity-input" style={inputStyle}
                      value={addActForm.causeId}
                      onChange={(e) => { setAddActForm({ ...addActForm, causeId: e.target.value }); setAddActErrors((p) => ({ ...p, causeId: "" })); }}>
                      <option value="">— Null (start new activity) —</option>
                      {causeOptions.map((l) => {
                        const linkedAct = actById[l.currentId];
                        const description = linkedAct?.description?.trim();
                        const fileName = linkedAct?.blobId ? blobMetaByBlobId[linkedAct.blobId]?.fileName : null;
                        return (
                          <option key={l.id} value={l.currentId}>
                            {description || fileName || l.logDescription || `Activity #${l.currentId}`}
                          </option>
                        );
                      })}
                    </select>
                    <FieldError msg={addActErrors.causeId} />
                    {causeOptions.length === 0 && (
                      <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "var(--a-text-faint)" }}>
                        No open activities with the connectivity option enabled yet — leave as Null to start a new chain.
                      </p>
                    )}
                  </div>
                  <div style={{ gridColumn: "1/-1" }}>
                    <label style={labelStyle}>Log Description *</label>
                    <textarea className="activity-input activity-textarea"
                      style={{ ...inputStyle, minHeight: 56, resize: "vertical", ...errBorder(addActErrors.logDescription) }}
                      placeholder="Notes for the file's activity chain (separate from the activity description above)..."
                      value={addActForm.logDescription}
                      onChange={(e) => { setAddActForm({ ...addActForm, logDescription: e.target.value }); setAddActErrors((p) => ({ ...p, logDescription: "" })); }} />
                    <FieldError msg={addActErrors.logDescription} />
                  </div>
                </>
              )}

              <div style={{ gridColumn: "1/-1" }}>
                <label style={labelStyle}>Attach File (optional, max {MAX_FILE_SIZE_MB} MB)</label>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <input type="file" ref={addActFileRef} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" style={{ display: "none" }}
                    onChange={(e) => {
                      const file = e.target.files[0] || null;
                      if (file && file.size > MAX_FILE_SIZE_BYTES) {
                        setAddActErrors((p) => ({ ...p, file: `File must be ${MAX_FILE_SIZE_MB} MB or smaller.` }));
                        e.target.value = "";
                        return;
                      }
                      setAddActFile(file);
                      setAddActErrors((p) => ({ ...p, file: "" }));
                    }} />
                  <button className="act-btn act-upload" onClick={() => addActFileRef.current.click()}>📎 Choose File</button>
                  {addActFile && <span className="activity-file-count">📄 {addActFile.name}</span>}
                  {addActFile && <button className="act-btn act-cancel" onClick={() => setAddActFile(null)}>✕</button>}
                </div>
                <FieldError msg={addActErrors.file} />
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
              <Btn variant="primary" onClick={handleAddAct} disabled={actSaving} icon="💾">{actSaving ? "Saving..." : "Save Activity"}</Btn>
              <Btn variant="ghost" icon="✕" onClick={() => { setShowAddAct(false); setAddActFile(null); setAddActErrors({}); setHasChain(false); }}>Cancel</Btn>
            </div>
          </div>
        )}



        {fileActLoading ? <p className="loading">Loading activities...</p> : (
          <>
            <div className="act-card-list">
              <TableScroller>
                <div style={{ minWidth: 760 }}>
                  <div className="act-header-row">
                    <div className="act-header-cell">Date &amp; File ID</div>
                    <div className="act-header-cell">Description</div>
                    <div className="act-header-cell">Log Description</div>
                    {canEdit(role) && <div className="act-header-cell" style={{ textAlign: "center" }}>Actions</div>}
                  </div>

                  {fileActs.length === 0 ? (
                    <div className="activity-empty">
                      {fileActError
                        ? "Failed to load activities. Please try again."
                        : canEdit(role) ? "No activities yet. Click \"+ Add Activity\" to start." : "No activities yet."}
                    </div>
                  ) : pagedActs.map((act) => (
                    editingAct === act.id ? (
                      <div key={act.id} className="act-row-card act-row-card--editing">
                        <div style={editCardStyle}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>
                                <div>
                                  <label style={labelStyle}>Date *</label>
                                  <div style={{ ...errBorder(editActErrors.date), borderRadius: 6 }}>
                                    <DatePicker value={editActForm.date}
                                      onChange={(date) => { setEditActForm({ ...editActForm, date }); setEditActErrors((p) => ({ ...p, date: "" })); }} />
                                  </div>
                                  <FieldError msg={editActErrors.date} />
                                </div>

                                <div style={{ gridColumn: "1/-1" }}>
                                  <label style={labelStyle}>Description *</label>
                                  <textarea className="activity-input activity-textarea"
                                    style={{ ...inputStyle, minHeight: 72, resize: "vertical", ...errBorder(editActErrors.description) }}
                                    value={editActForm.description}
                                    onChange={(e) => { setEditActForm({ ...editActForm, description: e.target.value }); setEditActErrors((p) => ({ ...p, description: "" })); }} />
                                  <FieldError msg={editActErrors.description} />
                                </div>

                                {/* Whether this activity is chain-linked was decided when it
                                    was first created (Continues From / Also Closes / Cause &
                                    Effect can't be reassigned from here) — so unlike the New
                                    Activity form there's no Yes/No toggle. editHasChain is
                                    just read off the activity's existing log row above, purely
                                    to decide whether to show these two fields at all. */}
                                {editHasChain && (
                                  <>
                                    <div style={{ gridColumn: "1/-1" }}>
                                      <span style={{
                                        display: "inline-flex", alignItems: "center", gap: 6,
                                        fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase",
                                        letterSpacing: "0.06em", color: "var(--a-teal)",
                                      }}>
                                        🔗 Linked activity
                                      </span>
                                    </div>
                                    <div>
                                      <label style={labelStyle}>Expire Date</label>
                                      <DatePicker value={editActForm.expireDate}
                                        onChange={(date) => setEditActForm({ ...editActForm, expireDate: date })} />
                                      <p style={{ margin: "4px 0 0", fontSize: "0.72rem", color: "var(--a-text-faint)" }}>
                                        Leave blank to clear it.
                                      </p>
                                    </div>
                                    <div style={{ gridColumn: "1/-1" }}>
                                      <label style={labelStyle}>Log Description *</label>
                                      <textarea className="activity-input activity-textarea"
                                        style={{ ...inputStyle, minHeight: 56, resize: "vertical", ...errBorder(editActErrors.logDescription) }}
                                        placeholder="Notes for the file's activity chain (separate from the activity description above)..."
                                        value={editActForm.logDescription ?? ""}
                                        onChange={(e) => { setEditActForm({ ...editActForm, logDescription: e.target.value }); setEditActErrors((p) => ({ ...p, logDescription: "" })); }} />
                                      <FieldError msg={editActErrors.logDescription} />
                                    </div>
                                  </>
                                )}

                                {/* ── File section ─────────────────────────────────────────
                                    If a blob is already attached: show a read-only notice.
                                    To change the file the user must delete & re-upload.
                                    If no blob: show the normal file-attach input.           */}
                                <div>
                                  <label style={labelStyle}>Attached File (max {MAX_FILE_SIZE_MB} MB)</label>
                                  {editActForm.blobId ? (
                                    <div style={{
                                      fontSize: "0.82rem",
                                      color: "var(--a-text-muted)",
                                      background: "var(--a-teal-04, rgba(20,184,166,0.04))",
                                      border: "1px solid var(--a-teal-20)",
                                      borderRadius: 6,
                                      padding: "8px 12px",
                                      lineHeight: 1.5,
                                    }}>
                                      📎 File attached. To change the file, delete this activity and re-upload.
                                    </div>
                                  ) : (
                                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                      <input type="file" ref={editActFileRef} accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" style={{ display: "none" }}
                                        onChange={(e) => {
                                          const file = e.target.files[0] || null;
                                          if (file && file.size > MAX_FILE_SIZE_BYTES) {
                                            setEditActErrors((p) => ({ ...p, file: `File must be ${MAX_FILE_SIZE_MB} MB or smaller.` }));
                                            e.target.value = "";
                                            return;
                                          }
                                          setEditActFile(file);
                                          setEditActErrors((p) => ({ ...p, file: "" }));
                                        }} />
                                      <button className="act-btn act-upload" onClick={() => editActFileRef.current.click()}>
                                        📎 {editActFile ? editActFile.name : "Attach File"}
                                      </button>
                                      {editActFile && (
                                        <button className="act-btn act-cancel" onClick={() => setEditActFile(null)}>✕</button>
                                      )}
                                    </div>
                                  )}
                                  <FieldError msg={editActErrors.file} />
                                </div>
                              </div>
                              <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                                <Btn variant="primary" onClick={() => handleEditAct(act.id)} disabled={actSaving} icon="💾">{actSaving ? "Saving..." : "Save"}</Btn>
                                <Btn variant="ghost" icon="✕" onClick={() => { setEditingAct(null); setEditActFile(null); setEditActErrors({}); setEditHasChain(false); }}>Cancel</Btn>
                              </div>
                            </div>
                          </div>
                    ) : (() => {
                      const log = fileLogHistory.find((l) => String(l.currentId) === String(act.id));
                      const isOpen = log?.logStatus === "open";
                      const flag = log ? expiryFlag(log.expireDate) : null;
                      // An activity with no CURRENT chain link — either it was created
                      // as a plain standalone entry, or it used to be chained and that
                      // chain has since been unlinked (see api/file-logs/{id} DELETE) —
                      // was never meant to carry an open/closed lifecycle. It gets its
                      // own neutral "standalone" (yellow) treatment instead of an Open
                      // pill + Close action that don't mean anything for a single entry.
                      const isStandalone = !log || !isChainLinked(log, fileLogHistory);

                      // Card accent color is strictly the 3-state red/green/yellow:
                      // closed → red, open → green, no connectivity → yellow.
                      // "Expiring soon"/"Expired" is still open — it only changes the
                      // small status badge inside the marquee, not the card's own color.
                      const cardState = isStandalone ? "standalone" : !isOpen ? "closed" : "open";

                      // This activity's own attached file (if any)
                      const ownMeta = act.blobId ? blobMetaByBlobId[act.blobId] : null;
                      const ownKind = ownMeta ? fileKindOf(ownMeta.fileName, ownMeta.fileType) : null;

                      // For a closed log, resolve the linked activity's file name instead
                      // of showing a raw activity id (per the design — never show a bare
                      // internal id for a link, always the file it belongs to).
                      let linkedFileName = null;
                      if (log && !isStandalone && !isOpen) {
                        const linkedId = log.effectId ?? log.causeId;
                        const linkedAct = linkedId != null ? actById[linkedId] : null;
                        const linkedMeta = linkedAct?.blobId ? blobMetaByBlobId[linkedAct.blobId] : null;
                        linkedFileName = linkedMeta?.fileName || null;
                      }

                      return (
                        <div key={act.id} className={`act-row-card${cardState ? ` act-row-card--${cardState}` : ""}`} onClick={() => openActDetail(act)}>
                          <div className="act-cell act-id-cell">
                            <div className="act-file-date" style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--a-text-body)" }}>📅 {fmtDate(act.date)}</div>
                            <span className="act-id-badge" style={{ marginTop: 4, display: "inline-block", fontSize: "0.82rem", fontWeight: 800, background: "var(--a-teal-15)", padding: "2px 9px", borderRadius: 6 }}>Activity ID: {String(act.id).padStart(3, "0")}</span>
                            {ownMeta?.fileName ? (
                              <div className="act-file-row">
                                <div className={`act-file-icon ${ownKind.cls}`}>{ownKind.label}</div>
                                <div className="act-file-name" title={ownMeta.fileName}>{ownMeta.fileName}</div>
                              </div>
                            ) : (
                              <div className="act-file-row">
                                <div className="act-file-icon generic">—</div>
                                <span className="act-file-none">No file attached</span>
                              </div>
                            )}
                          </div>

                          <div className="act-cell act-cell-desc">
                            <div className="act-cell-label">Description</div>
                            {act.description ? (
                              <div className="act-scroll-box">{act.description}</div>
                            ) : (
                              <span style={{ color: "var(--a-text-faint)", fontSize: "0.8rem" }}>—</span>
                            )}
                          </div>

                          <div className="act-cell act-log-cell">
                            <div className="act-cell-label">Log Description</div>

                            {!isStandalone && log && isOpen ? (
                              // Open (incl. expiring/expired) chain entries get an infinite
                              // marquee cycling: log description ── expire date ── per request.
                              <div className="act-marquee" onClick={(e) => e.stopPropagation()}>
                                <div className="act-marquee-viewport">
                                  <div className="act-marquee-track">
                                    {[0, 1].map((i) => (
                                      <span className="act-marquee-item" key={i} aria-hidden={i === 1 || undefined}>
                                        <span>{log.logDescription || "No log description"}</span>
                                        <span className="act-marquee-sep">──────</span>
                                        <span>{log.expireDate ? fmtDate(log.expireDate) : "—"}</span>
                                        <span className="act-marquee-sep">──────</span>
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <>
                                {log?.logDescription ? (
                                  <div className="act-scroll-box">{log.logDescription}</div>
                                ) : (
                                  <span style={{ color: "var(--a-text-faint)", fontSize: "0.8rem" }}>—</span>
                                )}

                                {!isStandalone && log && !isOpen && (
                                  <div className="act-status-meta">
                                    <div className="act-status-meta-row">
                                      <span className="act-pill act-pill-closed">🔴 Closed</span>
                                    </div>
                                    {log.logDate && (
                                      <div className="act-status-line">Closed on: <strong>{fmtDate(log.logDate)}</strong></div>
                                    )}
                                    {linkedFileName && (
                                      <div className="act-linked-file">🔗 Linked File: {linkedFileName}</div>
                                    )}
                                  </div>
                                )}
                              </>
                            )}
                          </div>

                          {canEdit(role) && (
                            <div className="act-cell act-actions-cell" onClick={(e) => e.stopPropagation()}>
                              <button className="act-icon-btn edit" title="Edit"
                                onClick={() => { setEditingAct(act.id); setEditActForm({ date: toISODate(act.date), status: act.status, description: act.description, blobId: act.blobId, expireDate: log?.expireDate ? toISODate(log.expireDate) : "", logDescription: log?.logDescription ?? "" }); setEditHasChain(!!(log?.expireDate || log?.causeId || log?.effectId || log?.logDescription)); }}>✏️</button>
                              {canDelete(role) && (
                                confirmKey === `act-${act.id}` ? (
                                  <ConfirmDelete
                                    label={deleteActLabel(act, fileLogHistory)}
                                    onConfirm={() => { setConfirmKey(null); handleDeleteAct(act); }}
                                    onCancel={() => setConfirmKey(null)}
                                  />
                                ) : (
                                  <button className="act-icon-btn delete" title="Delete"
                                    onClick={() => setConfirmKey(`act-${act.id}`)}>🗑️</button>
                                )
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })()
                  ))}
                </div>
              </TableScroller>
            </div>
            <Pagination total={fileActs.length} page={actPage} onChange={setActPage} />
            <p className="table-hint">💡 Click any row to view activity details and attached file</p>
          </>
        )}
      </div>
    );
  }

  // ── Level 0: File list ────────────────────────────────────────
  const fileColSpan = canEdit(role) ? 7 : 6;
  const pagedFiles = files.slice((filePage - 1) * PAGE_SIZE, filePage * PAGE_SIZE);

  return (
    <div className="content-section">
      {showActTypeModal && (
        <ActivityTypeModal
          role={role}
          onClose={() => { setShowActTypeModal(false); refreshActivityTypes(); }}
        />
      )}

      <div className="activity-header" style={{ alignItems: "center" }}>
        <h1 style={{ margin: 0 }}>List of Files</h1>
        <div style={{ display: "flex", gap: 10 }}>
          {canEdit(role) && (
            <Btn variant="ghost" icon="⬇️" onClick={handleExportAll} disabled={exporting}>
              {exporting ? "Exporting..." : "Export"}
            </Btn>
          )}
          {canAdd(role) && !editingFile && (
            <Btn variant="teal" icon="＋" onClick={() => {
              setShowAddFile(true);
              setAddFileForm({ fileId: "", activity: "", subject: "", description: "", date: localDate(), status: "ACTIVE" });
            }}>
              + Add File
            </Btn>
          )}
        </div>
      </div>

      {canAdd(role) && showAddFile && (
        <div style={{ ...editCardStyle, marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
            <Btn variant="back" onClick={() => setShowAddFile(false)} icon="←">← Back</Btn>
            <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--a-teal)" }}>New File</h3>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>
            <ActivityTypeField
              value={addFileForm.activity}
              onChange={(v) => setAddFileForm({ ...addFileForm, activity: v })}
              errors={addFileErrors}
              setErrors={setAddFileErrors}
            />
            <div>
              <label style={labelStyle}>Subject *</label>
              <input className="activity-input" style={{ ...inputStyle, ...errBorder(addFileErrors.subject) }} placeholder="e.g. Purchase of goods"
                value={addFileForm.subject} onChange={(e) => { setAddFileForm({ ...addFileForm, subject: e.target.value }); setAddFileErrors((p) => ({ ...p, subject: "" })); }} />
              <FieldError msg={addFileErrors.subject} />
            </div>
            <div>
              <label style={labelStyle}>Date *</label>
              <div style={{ ...errBorder(addFileErrors.date), borderRadius: 6 }}>
                <DatePicker value={addFileForm.date}
                  onChange={(date) => { setAddFileForm({ ...addFileForm, date }); setAddFileErrors((p) => ({ ...p, date: "" })); }} />
              </div>
              <FieldError msg={addFileErrors.date} />
            </div>
            <div>
              <label style={labelStyle}>Status</label>
              <select className="activity-input" style={inputStyle} value={addFileForm.status}
                onChange={(e) => setAddFileForm({ ...addFileForm, status: e.target.value })}>
                <option value="ACTIVE">Active</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>
            <div style={{ gridColumn: "1/-1" }}>
              <label style={labelStyle}>Description *</label>
              <textarea className="activity-input activity-textarea"
                style={{ ...inputStyle, minHeight: 64, resize: "vertical", ...errBorder(addFileErrors.description) }}
                placeholder="Optional details..."
                value={addFileForm.description} onChange={(e) => { setAddFileForm({ ...addFileForm, description: e.target.value }); setAddFileErrors((p) => ({ ...p, description: "" })); }} />
              <FieldError msg={addFileErrors.description} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
            <Btn variant="primary" onClick={handleAddFile} disabled={fileSaving} icon="💾">{fileSaving ? "Saving..." : "Save"}</Btn>
            <Btn variant="ghost" icon="✕" onClick={() => { setShowAddFile(false); setAddFileErrors({}); }}>Cancel</Btn>
          </div>
        </div>
      )}

      {fileLoading ? <p className="loading">Loading...</p> : (
        <>
          <div className="activity-table-wrap">
            <TableScroller>
              <table className="activity-table" style={{ minWidth: 640 }}>
                <thead>
                  <tr>
                    <th style={{ width: 52 }}>ID</th>
                    <th style={{ width: 120 }}>Date</th>
                    <th>File</th>
                    <th>Subject</th>
                    <th style={{ width: 100 }}>Status</th>
                    <th>Description</th>
                    {canEdit(role) && <th style={{ textAlign: "center", width: 100 }}>Actions</th>}
                  </tr>
                </thead>
                <tbody>
                  {files.length === 0 ? (
                    <tr><td colSpan={fileColSpan} className="activity-empty">
                      {fileError
                        ? "Failed to load files. Please try again."
                        : canEdit(role) ? "No files found. Click \"+ Add File\" to create one." : "No files found."}
                    </td></tr>
                  ) : pagedFiles.map((row, idx) => (
                    <tr key={row.fileId}
                      style={{ cursor: editingFile === row.fileId ? "default" : "pointer", background: idx % 2 === 0 ? "transparent" : "var(--a-teal-04, rgba(20,184,166,0.04))" }}
                      onMouseEnter={(e) => { if (editingFile !== row.fileId) e.currentTarget.style.background = "var(--a-teal-10, rgba(20,184,166,0.10))"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = idx % 2 === 0 ? "transparent" : "var(--a-teal-04, rgba(20,184,166,0.04))"; }}>
                      {editingFile === row.fileId ? (
                        <td colSpan={fileColSpan} style={{ padding: 0 }}>
                          <div style={editCardStyle}>
                            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
                              <Btn variant="back" icon="←" onClick={() => { setEditingFile(null); setEditFileErrors({}); }}>← Back</Btn>
                              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--a-teal)" }}>Edit File</h3>
                            </div>
                            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 20px" }}>
                              <ActivityTypeField
                                value={editFileForm.activity}
                                onChange={(v) => setEditFileForm({ ...editFileForm, activity: v })}
                                errors={editFileErrors}
                                setErrors={setEditFileErrors}
                              />
                              <div>
                                <label style={labelStyle}>Subject *</label>
                                <input className="activity-input" style={{ ...inputStyle, ...errBorder(editFileErrors.subject) }} value={editFileForm.subject}
                                  onChange={(e) => { setEditFileForm({ ...editFileForm, subject: e.target.value }); setEditFileErrors((p) => ({ ...p, subject: "" })); }} />
                                <FieldError msg={editFileErrors.subject} />
                              </div>
                              <div>
                                <label style={labelStyle}>Date *</label>
                                <div style={{ ...errBorder(editFileErrors.date), borderRadius: 6 }}>
                                  <DatePicker value={editFileForm.date}
                                    onChange={(date) => { setEditFileForm({ ...editFileForm, date }); setEditFileErrors((p) => ({ ...p, date: "" })); }} />
                                </div>
                                <FieldError msg={editFileErrors.date} />
                              </div>
                              <div>
                                <label style={labelStyle}>Status</label>
                                <select className="activity-input" style={inputStyle}
                                  value={["ACTIVE", "CLOSED"].includes(String(editFileForm.status || "").toUpperCase()) ? String(editFileForm.status).toUpperCase() : "ACTIVE"}
                                  onChange={(e) => setEditFileForm({ ...editFileForm, status: e.target.value })}>
                                  <option value="ACTIVE">Active</option>
                                  <option value="CLOSED">Closed</option>
                                </select>
                              </div>
                              <div style={{ gridColumn: "1/-1" }}>
                                <label style={labelStyle}>Description *</label>
                                <textarea className="activity-input activity-textarea"
                                  style={{ ...inputStyle, minHeight: 72, resize: "vertical", ...errBorder(editFileErrors.description) }}
                                  value={editFileForm.description}
                                  onChange={(e) => { setEditFileForm({ ...editFileForm, description: e.target.value }); setEditFileErrors((p) => ({ ...p, description: "" })); }} />
                                <FieldError msg={editFileErrors.description} />
                              </div>
                            </div>
                            <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
                              <Btn variant="primary" onClick={() => handleEditFile(row.fileId)} disabled={fileSaving} icon="💾">{fileSaving ? "Saving..." : "Save"}</Btn>
                              <Btn variant="ghost" icon="✕" onClick={() => { setEditingFile(null); setEditFileErrors({}); }}>Cancel</Btn>
                            </div>
                          </div>
                        </td>
                      ) : (
                        <>
                          <td style={{ color: "var(--a-teal)", fontWeight: 700, whiteSpace: "nowrap" }} onClick={() => openFileDetail(row)}>{row.fileId}</td>
                          <td style={{ whiteSpace: "nowrap" }} onClick={() => openFileDetail(row)}>{fmtDate(row.date)}</td>
                          <td onClick={() => openFileDetail(row)}><strong style={{ color: "var(--a-teal)", fontWeight: 600 }}>{row.activity}</strong></td>
                          <td onClick={() => openFileDetail(row)}>{row.subject}</td>
                          <td onClick={() => openFileDetail(row)}><StatusBadge status={row.status} /></td>
                          <DescriptionCell text={row.description} onClick={() => openFileDetail(row)} />
                          {canEdit(role) && (
                            <td style={{ textAlign: "center", whiteSpace: "nowrap" }}>
                              <button title="Export this file"
                                style={iconBtn("var(--a-teal)", "var(--a-teal-05)", "var(--a-teal-20)")}
                                disabled={exportingFileId === row.fileId}
                                onClick={(e) => { e.stopPropagation(); handleExportFile(row.fileId); }}>
                                {exportingFileId === row.fileId ? "⏳" : "⬇️"}
                              </button>
                              <button title="Edit"
                                style={iconBtn("var(--a-indigo,#6366f1)", "var(--a-indigo-10,rgba(99,102,241,0.1))", "var(--a-indigo-30,rgba(99,102,241,0.3))")}
                                onClick={(e) => { e.stopPropagation(); setEditingFile(row.fileId); setEditFileForm({ activity: row.activity, subject: row.subject, description: row.description, date: toISODate(row.date), status: ["ACTIVE", "CLOSED"].includes(String(row.status).toUpperCase()) ? String(row.status).toUpperCase() : "ACTIVE" }); }}>✏️</button>
                              {canDelete(role) && (
                                confirmKey === `file-${row.fileId}` ? (
                                  <ConfirmDelete label="Delete file?"
                                    onConfirm={() => { setConfirmKey(null); handleDeleteFile(row.fileId); }}
                                    onCancel={() => setConfirmKey(null)} />
                                ) : (
                                  <button title="Delete"
                                    style={iconBtn("var(--a-danger,#ef4444)", "var(--a-danger-10,rgba(239,68,68,0.1))", "var(--a-danger-30,rgba(239,68,68,0.3))")}
                                    onClick={(e) => { e.stopPropagation(); setConfirmKey(`file-${row.fileId}`); }}>🗑️</button>
                                )
                              )}
                            </td>
                          )}
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </TableScroller>
          </div>
          <Pagination total={files.length} page={filePage} onChange={setFilePage} />
          <p className="table-hint">💡 Click any row to open its activities</p>
        </>
      )}
    </div>
  );
}