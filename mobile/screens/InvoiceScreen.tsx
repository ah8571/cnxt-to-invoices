import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { supabase } from "../lib/supabase";
import TopBar from "../components/TopBar";

type LineItem = { description: string; quantity: string; rate: string };

type Props = {
  onSignOut: () => void;
  onViewDrafts?: () => void;
  onViewInvoices?: () => void;
  loadDraftId?: string;
  loadDraftPayload?: Record<string, unknown>;
};

const CURRENCIES = ["USD", "EUR", "GBP", "CAD"] as const;
type Currency = (typeof CURRENCIES)[number];
const CURRENCY_SYMBOLS: Record<Currency, string> = { USD: "$", EUR: "€", GBP: "£", CAD: "CA$" };

function calcTotals(items: LineItem[], taxRate: string, discount: string) {
  const subtotal = items.reduce((sum, i) => sum + (parseFloat(i.quantity) || 0) * (parseFloat(i.rate) || 0), 0);
  const discountAmt = parseFloat(discount) || 0;
  const taxable = Math.max(0, subtotal - discountAmt);
  const taxAmt = taxable * ((parseFloat(taxRate) || 0) / 100);
  return { subtotal, discountAmt, taxAmt, total: taxable + taxAmt };
}

function defaultItem(): LineItem {
  return { description: "", quantity: "1", rate: "" };
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function InvoiceScreen({ onSignOut, onViewDrafts, onViewInvoices, loadDraftId, loadDraftPayload }: Props) {
  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [businessWebsite, setBusinessWebsite] = useState("");
  const [businessAddress, setBusinessAddress] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [clientAddress, setClientAddress] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("INV-001");
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState("");
  const [currency, setCurrency] = useState<Currency>("USD");
  const [taxRate, setTaxRate] = useState("");
  const [discount, setDiscount] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([defaultItem()]);
  const [exporting, setExporting] = useState(false);
  const [status, setStatus] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { loadProfile(); }, []);

  useEffect(() => {
    if (loadDraftPayload) {
      loadFromPayload(loadDraftPayload);
      setCurrentDraftId(loadDraftId ?? null);
    }
  }, [loadDraftPayload, loadDraftId]);

  function loadFromPayload(p: Record<string, unknown>) {
    if (p.businessName) setBusinessName(p.businessName as string);
    if (p.businessEmail) setBusinessEmail(p.businessEmail as string);
    if (p.businessPhone) setBusinessPhone(p.businessPhone as string);
    if (p.businessWebsite) setBusinessWebsite(p.businessWebsite as string);
    if (p.businessAddress) setBusinessAddress(p.businessAddress as string);
    if (p.logoUrl !== undefined) setLogoUrl(p.logoUrl as string);
    if (p.clientName) setClientName(p.clientName as string);
    if (p.clientEmail) setClientEmail(p.clientEmail as string);
    if (p.clientAddress) setClientAddress(p.clientAddress as string);
    if (p.invoiceNumber) setInvoiceNumber(p.invoiceNumber as string);
    if (p.issueDate) setIssueDate(p.issueDate as string);
    if (p.dueDate) setDueDate(p.dueDate as string);
    if (p.currency && (CURRENCIES as readonly string[]).includes(p.currency as string)) setCurrency(p.currency as Currency);
    if (p.taxRate !== undefined) setTaxRate(String(p.taxRate));
    if (p.discount !== undefined) setDiscount(String(p.discount));
    if (p.notes) setNotes(p.notes as string);
    if (Array.isArray(p.items)) {
      setItems((p.items as Array<{ description: string; quantity: number | string; rate: number | string }>).map((i) => ({
        description: String(i.description || ""),
        quantity: String(i.quantity || "1"),
        rate: String(i.rate || ""),
      })));
    }
  }

  async function loadProfile() {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;
    setUserEmail(user.email ?? "");

    const { data } = await supabase
      .from("invoice_business_profiles")
      .select("business_name, email, phone, website, address_line_1, logo_url")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (data) {
      if (data.business_name) setBusinessName(data.business_name);
      if (data.email) setBusinessEmail(data.email);
      if (data.phone) setBusinessPhone(data.phone);
      if (data.website) setBusinessWebsite(data.website);
      if (data.address_line_1) setBusinessAddress(data.address_line_1);
      if (data.logo_url) setLogoUrl(data.logo_url);
    }
  }

  async function saveProfile() {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;
    await supabase.from("invoice_business_profiles").upsert(
      {
        user_id: user.id,
        business_name: businessName,
        email: businessEmail,
        phone: businessPhone,
        website: businessWebsite,
        address_line_1: businessAddress,
        // Only persist http(s) logo URLs — local file URIs are device-scoped and can't be saved to DB
        ...(logoUrl.startsWith("http") ? { logo_url: logoUrl } : {}),
      },
      { onConflict: "user_id" }
    );
    setStatus("Business info saved.");
    setTimeout(() => setStatus(""), 3000);
  }

  async function pickLogo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setLogoUrl(result.assets[0].uri);
      scheduleAutoSave();
    }
  }

  async function buildLogoDataUri(): Promise<string> {
    if (!logoUrl) return "";
    if (logoUrl.startsWith("http")) return logoUrl;
    try {
      const b64 = await FileSystem.readAsStringAsync(logoUrl, { encoding: FileSystem.EncodingType.Base64 });
      const ext = logoUrl.split(".").pop()?.toLowerCase() ?? "jpeg";
      const mime = ext === "png" ? "image/png" : ext === "gif" ? "image/gif" : "image/jpeg";
      return `data:${mime};base64,${b64}`;
    } catch {
      return logoUrl;
    }
  }

  function scheduleAutoSave() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveDraft(true), 5000);
  }

  async function saveDraft(silent = false) {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;

    const payload = {
      businessName, businessEmail, businessPhone, businessWebsite, businessAddress, logoUrl,
      clientName, clientEmail, clientAddress,
      invoiceNumber, issueDate, dueDate, currency, taxRate, discount, notes,
      items: items.map((i) => ({
        description: i.description,
        quantity: parseFloat(i.quantity) || 1,
        rate: parseFloat(i.rate) || 0,
      })),
    };

    const draftName = invoiceNumber || clientName || "Untitled draft";

    if (currentDraftId) {
      await supabase.from("invoice_drafts").update({ draft_name: draftName, payload_json: payload }).eq("id", currentDraftId);
    } else {
      const { data } = await supabase.from("invoice_drafts").insert({ user_id: user.id, draft_name: draftName, payload_json: payload }).select("id").single();
      if (data?.id) setCurrentDraftId(data.id);
    }

    setStatus(silent ? "Auto-saved." : "Draft saved.");
    setTimeout(() => setStatus(""), 3000);
  }

  async function buildInvoiceHtml(): Promise<string> {
    const sym = CURRENCY_SYMBOLS[currency];
    const { subtotal, discountAmt, taxAmt, total } = calcTotals(items, taxRate, discount);
    const rows = items.map((item) => {
      const lt = (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
      return `<tr><td>${item.description || "—"}</td><td style="text-align:center">${item.quantity}</td><td style="text-align:right">${sym}${parseFloat(item.rate || "0").toFixed(2)}</td><td style="text-align:right">${sym}${lt.toFixed(2)}</td></tr>`;
    }).join("");
    const resolvedLogo = await buildLogoDataUri();
    const logoHtml = resolvedLogo ? `<img src="${resolvedLogo}" style="max-height:60px;max-width:160px;object-fit:contain;display:block;margin-bottom:8px"/>` : "";
    return `<!DOCTYPE html><html><head><meta charset="UTF-8"/><style>
body{font-family:-apple-system,sans-serif;color:#1f1a17;padding:40px;max-width:680px;margin:0 auto}
.header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:36px}
h1{font-size:28px;margin:0 0 4px}.meta{color:#675f58;font-size:13px;margin:2px 0}
.parties{display:flex;gap:40px;margin-bottom:32px}
.party h3{font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9a8f87;margin:0 0 6px}
.party p{margin:2px 0;font-size:14px}
table{width:100%;border-collapse:collapse;margin-bottom:20px}
th{text-align:left;font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#9a8f87;padding-bottom:8px;border-bottom:2px solid #d8cfc3}
td{padding:8px 0;border-bottom:1px solid #e8e0d6;font-size:14px}
.totals{margin-left:auto;width:240px;border-collapse:collapse}
.totals td{padding:4px 0;font-size:14px;border:none}.totals td:last-child{text-align:right}
.totals .grand td{font-weight:700;font-size:16px;border-top:2px solid #1f1a17;padding-top:8px}
.notes{margin-top:32px;font-size:13px;color:#675f58;white-space:pre-line}
.footer{margin-top:48px;border-top:1px solid #e8e0d6;padding-top:12px;font-size:10px;letter-spacing:1.5px;text-transform:uppercase;color:#9a8f87;text-align:center}
</style></head><body>
<div class="header"><div>${logoHtml}<h1>Invoice</h1>${invoiceNumber ? `<p class="meta">${invoiceNumber}</p>` : ""}</div>
<div style="text-align:right">${issueDate ? `<p class="meta">Issued: ${issueDate}</p>` : ""}${dueDate ? `<p class="meta">Due: ${dueDate}</p>` : ""}</div></div>
<div class="parties">
<div class="party"><h3>From</h3>${businessName ? `<p><strong>${businessName}</strong></p>` : ""}${businessEmail ? `<p>${businessEmail}</p>` : ""}${businessPhone ? `<p>${businessPhone}</p>` : ""}${businessWebsite ? `<p>${businessWebsite}</p>` : ""}${businessAddress ? `<p>${businessAddress.replace(/\n/g, "<br/>")}</p>` : ""}</div>
<div class="party"><h3>To</h3>${clientName ? `<p><strong>${clientName}</strong></p>` : ""}${clientEmail ? `<p>${clientEmail}</p>` : ""}${clientAddress ? `<p>${clientAddress.replace(/\n/g, "<br/>")}</p>` : ""}</div>
</div>
<table><thead><tr><th>Description</th><th style="text-align:center">Qty</th><th style="text-align:right">Rate</th><th style="text-align:right">Total</th></tr></thead><tbody>${rows}</tbody></table>
<div style="display:flex;justify-content:flex-end"><table class="totals">
<tr><td>Subtotal</td><td>${sym}${subtotal.toFixed(2)}</td></tr>
${discountAmt > 0 ? `<tr><td>Discount</td><td>−${sym}${discountAmt.toFixed(2)}</td></tr>` : ""}
${taxAmt > 0 ? `<tr><td>Tax (${taxRate}%)</td><td>${sym}${taxAmt.toFixed(2)}</td></tr>` : ""}
<tr class="grand"><td>Total (${currency})</td><td>${sym}${total.toFixed(2)}</td></tr>
</table></div>
${notes ? `<div class="notes"><strong>Notes</strong><br/>${notes}</div>` : ""}
<div class="footer">Free Invoice Maker | cnxt to invoices</div>
</body></html>`;
  }

  async function downloadInvoice() {
    setExporting(true);
    await saveDraft(true);
    try {
      const { uri } = await Print.printToFileAsync({ html: await buildInvoiceHtml() });
      const safeName = [businessName, invoiceNumber]
        .filter(Boolean)
        .join("_")
        .replace(/[^a-zA-Z0-9_\-]/g, "_") || "invoice";
      const destUri = (FileSystem.cacheDirectory ?? "") + safeName + ".pdf";
      await FileSystem.copyAsync({ from: uri, to: destUri });
      await Sharing.shareAsync(destUri, { mimeType: "application/pdf", dialogTitle: safeName + ".pdf", UTI: "com.adobe.pdf" });
    } catch { /* user dismissed */ }
    setExporting(false);
  }

  function updateItem(index: number, field: keyof LineItem, value: string) {
    setItems(items.map((item, i) => (i === index ? { ...item, [field]: value } : item)));
    scheduleAutoSave();
  }

  function addItem() { setItems([...items, defaultItem()]); }

  function removeItem(index: number) {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  function resetForm() {
    setClientName(""); setClientEmail(""); setClientAddress("");
    setInvoiceNumber("INV-001"); setIssueDate(todayIso()); setDueDate("");
    setCurrency("USD"); setTaxRate(""); setDiscount("");
    setNotes(""); setItems([defaultItem()]); setStatus(""); setCurrentDraftId(null);
    setLogoUrl(""); setShowPreview(false);
  }

  async function handleSignOut() { await supabase.auth.signOut(); onSignOut(); }

  const { subtotal, discountAmt, taxAmt, total } = calcTotals(items, taxRate, discount);
  const sym = CURRENCY_SYMBOLS[currency];
  const hasBreakdown = discountAmt > 0 || taxAmt > 0;

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
      <TopBar activeScreen="invoice" onDrafts={onViewDrafts ?? (() => {})} onInvoices={onViewInvoices ?? (() => {})} onSignOut={handleSignOut} />

      {userEmail ? <Text style={styles.userEmail}>{userEmail}</Text> : null}
      {status ? <Text style={styles.autoSaveStatus}>{status}</Text> : null}

      <Pressable style={styles.newInvoiceBtn} onPress={resetForm}>
        <Text style={styles.newInvoiceBtnLabel}>+ New invoice</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Your business</Text>
      <TextInput style={styles.input} placeholder="Business name" placeholderTextColor="#9a8f87" value={businessName} onChangeText={(v) => { setBusinessName(v); scheduleAutoSave(); }} />
      <TextInput style={styles.input} placeholder="Email" placeholderTextColor="#9a8f87" keyboardType="email-address" autoCapitalize="none" value={businessEmail} onChangeText={(v) => { setBusinessEmail(v); scheduleAutoSave(); }} />
      <TextInput style={styles.input} placeholder="Phone" placeholderTextColor="#9a8f87" keyboardType="phone-pad" value={businessPhone} onChangeText={(v) => { setBusinessPhone(v); scheduleAutoSave(); }} />
      <TextInput style={styles.input} placeholder="Website" placeholderTextColor="#9a8f87" autoCapitalize="none" keyboardType="url" value={businessWebsite} onChangeText={(v) => { setBusinessWebsite(v); scheduleAutoSave(); }} />
      <TextInput style={[styles.input, styles.textarea]} placeholder="Address" placeholderTextColor="#9a8f87" multiline value={businessAddress} onChangeText={(v) => { setBusinessAddress(v); scheduleAutoSave(); }} />
      <Pressable style={styles.chooseLogoBtn} onPress={pickLogo}>
        <Text style={styles.chooseLogoBtnLabel}>{logoUrl ? "Change logo" : "Choose logo"}</Text>
      </Pressable>
      {logoUrl ? (
        <View style={styles.logoRow}>
          <Image source={{ uri: logoUrl }} style={styles.logoPreview} resizeMode="contain" />
          <Pressable onPress={() => { setLogoUrl(""); scheduleAutoSave(); }} style={styles.removeLogoBtn}>
            <Text style={styles.removeLogoBtnLabel}>Remove</Text>
          </Pressable>
        </View>
      ) : null}
      <Pressable style={styles.saveProfileBtn} onPress={saveProfile}>
        <Text style={styles.saveProfileBtnLabel}>Save business info</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Client</Text>
      <TextInput style={styles.input} placeholder="Client name" placeholderTextColor="#9a8f87" value={clientName} onChangeText={(v) => { setClientName(v); scheduleAutoSave(); }} />
      <TextInput style={styles.input} placeholder="Client email" placeholderTextColor="#9a8f87" keyboardType="email-address" autoCapitalize="none" value={clientEmail} onChangeText={(v) => { setClientEmail(v); scheduleAutoSave(); }} />
      <TextInput style={[styles.input, styles.textarea]} placeholder="Client address" placeholderTextColor="#9a8f87" multiline value={clientAddress} onChangeText={(v) => { setClientAddress(v); scheduleAutoSave(); }} />

      <Text style={styles.sectionTitle}>Invoice details</Text>
      <TextInput style={styles.input} placeholder="Invoice number" placeholderTextColor="#9a8f87" value={invoiceNumber} onChangeText={(v) => { setInvoiceNumber(v); scheduleAutoSave(); }} />
      <TextInput style={styles.input} placeholder="Issue date (YYYY-MM-DD)" placeholderTextColor="#9a8f87" value={issueDate} onChangeText={(v) => { setIssueDate(v); scheduleAutoSave(); }} />
      <TextInput style={styles.input} placeholder="Due date (YYYY-MM-DD)" placeholderTextColor="#9a8f87" value={dueDate} onChangeText={(v) => { setDueDate(v); scheduleAutoSave(); }} />

      <View style={styles.currencyRow}>
        {CURRENCIES.map((c) => (
          <Pressable key={c} style={[styles.currencyChip, currency === c && styles.currencyChipActive]} onPress={() => { setCurrency(c); scheduleAutoSave(); }}>
            <Text style={[styles.currencyLabel, currency === c && styles.currencyLabelActive]}>{c}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.twoUp}>
        <TextInput style={[styles.input, styles.twoUpField]} placeholder="Tax rate %" placeholderTextColor="#9a8f87" keyboardType="decimal-pad" value={taxRate} onChangeText={(v) => { setTaxRate(v); scheduleAutoSave(); }} />
        <TextInput style={[styles.input, styles.twoUpField]} placeholder="Discount" placeholderTextColor="#9a8f87" keyboardType="decimal-pad" value={discount} onChangeText={(v) => { setDiscount(v); scheduleAutoSave(); }} />
      </View>

      <Text style={styles.sectionTitle}>Line items</Text>
      {items.map((item, index) => (
        <View key={index} style={styles.lineItem}>
          <TextInput style={styles.input} placeholder="Description" placeholderTextColor="#9a8f87" value={item.description} onChangeText={(v) => updateItem(index, "description", v)} />
          <View style={styles.lineRow}>
            <TextInput style={[styles.input, styles.lineQty]} placeholder="Qty" placeholderTextColor="#9a8f87" keyboardType="decimal-pad" value={item.quantity} onChangeText={(v) => updateItem(index, "quantity", v)} />
            <TextInput style={[styles.input, styles.lineRate]} placeholder="Rate" placeholderTextColor="#9a8f87" keyboardType="decimal-pad" value={item.rate} onChangeText={(v) => updateItem(index, "rate", v)} />
            <Text style={styles.lineTotal}>{sym}{((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)).toFixed(2)}</Text>
            {items.length > 1 && (
              <Pressable onPress={() => removeItem(index)} style={styles.removeBtn}>
                <Text style={styles.removeBtnLabel}>✕</Text>
              </Pressable>
            )}
          </View>
        </View>
      ))}

      <Pressable style={styles.addItemBtn} onPress={addItem}>
        <Text style={styles.addItemLabel}>+ Add item</Text>
      </Pressable>

      <Text style={styles.sectionTitle}>Notes</Text>
      <TextInput style={[styles.input, styles.notesInput]} placeholder="Payment terms, bank details, etc." placeholderTextColor="#9a8f87" multiline value={notes} onChangeText={(v) => { setNotes(v); scheduleAutoSave(); }} />

      <View style={styles.totalsBlock}>
        {hasBreakdown && (
          <>
            <View style={styles.totalRow}><Text style={styles.subLabel}>Subtotal</Text><Text style={styles.subAmt}>{sym}{subtotal.toFixed(2)}</Text></View>
            {discountAmt > 0 && <View style={styles.totalRow}><Text style={styles.subLabel}>Discount</Text><Text style={styles.subAmt}>−{sym}{discountAmt.toFixed(2)}</Text></View>}
            {taxAmt > 0 && <View style={styles.totalRow}><Text style={styles.subLabel}>Tax ({taxRate}%)</Text><Text style={styles.subAmt}>{sym}{taxAmt.toFixed(2)}</Text></View>}
          </>
        )}
        <View style={[styles.totalRow, hasBreakdown && styles.totalRowFinal]}>
          <Text style={styles.totalLabel}>Total</Text>
          <Text style={styles.totalAmount}>{sym}{total.toFixed(2)}</Text>
        </View>
      </View>

      <Pressable style={styles.previewToggle} onPress={() => setShowPreview((v) => !v)}>
        <Text style={styles.previewToggleLabel}>{showPreview ? "Hide preview" : "Preview invoice"}</Text>
      </Pressable>

      {showPreview && (
        <View style={styles.previewCard}>
          <View style={styles.previewHeaderRow}>
            <View style={{ flex: 1 }}>
              {logoUrl ? <Image source={{ uri: logoUrl }} style={styles.previewLogo} resizeMode="contain" /> : null}
              <Text style={styles.previewTitle}>Invoice</Text>
              {invoiceNumber ? <Text style={styles.previewMeta}>{invoiceNumber}</Text> : null}
            </View>
            <View style={{ alignItems: "flex-end" }}>
              {issueDate ? <Text style={styles.previewMeta}>Issued: {issueDate}</Text> : null}
              {dueDate ? <Text style={styles.previewMeta}>Due: {dueDate}</Text> : null}
            </View>
          </View>
          <View style={styles.previewParties}>
            <View style={styles.previewParty}>
              <Text style={styles.previewPartyLabel}>FROM</Text>
              {businessName ? <Text style={styles.previewPartyName}>{businessName}</Text> : null}
              {businessEmail ? <Text style={styles.previewPartySub}>{businessEmail}</Text> : null}
              {businessPhone ? <Text style={styles.previewPartySub}>{businessPhone}</Text> : null}
            </View>
            <View style={styles.previewParty}>
              <Text style={styles.previewPartyLabel}>TO</Text>
              {clientName ? <Text style={styles.previewPartyName}>{clientName}</Text> : null}
              {clientEmail ? <Text style={styles.previewPartySub}>{clientEmail}</Text> : null}
            </View>
          </View>
          <View style={styles.previewDivider} />
          <View style={styles.previewItemsHeader}>
            <Text style={[styles.previewItemCol, { flex: 2 }]}>Description</Text>
            <Text style={[styles.previewItemCol, { width: 40, textAlign: "center" }]}>Qty</Text>
            <Text style={[styles.previewItemCol, { width: 70, textAlign: "right" }]}>Amount</Text>
          </View>
          {items.map((item, idx) => (
            <View key={idx} style={styles.previewItemRow}>
              <Text style={[styles.previewItemText, { flex: 2 }]} numberOfLines={1}>{item.description || "—"}</Text>
              <Text style={[styles.previewItemText, { width: 40, textAlign: "center" }]}>{item.quantity}</Text>
              <Text style={[styles.previewItemText, { width: 70, textAlign: "right" }]}>{sym}{((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)).toFixed(2)}</Text>
            </View>
          ))}
          <View style={styles.previewDivider} />
          {hasBreakdown && (
            <>
              <View style={styles.previewTotRow}><Text style={styles.previewTotLabel}>Subtotal</Text><Text style={styles.previewTotVal}>{sym}{subtotal.toFixed(2)}</Text></View>
              {discountAmt > 0 && <View style={styles.previewTotRow}><Text style={styles.previewTotLabel}>Discount</Text><Text style={styles.previewTotVal}>−{sym}{discountAmt.toFixed(2)}</Text></View>}
              {taxAmt > 0 && <View style={styles.previewTotRow}><Text style={styles.previewTotLabel}>Tax ({taxRate}%)</Text><Text style={styles.previewTotVal}>{sym}{taxAmt.toFixed(2)}</Text></View>}
            </>
          )}
          <View style={[styles.previewTotRow, { borderTopWidth: 1, borderTopColor: "#1f1a17", marginTop: 4, paddingTop: 8 }]}>
            <Text style={[styles.previewTotLabel, { fontWeight: "700", color: "#1f1a17" }]}>Total ({currency})</Text>
            <Text style={[styles.previewTotVal, { fontWeight: "700", color: "#0d6b61", fontSize: 15 }]}>{sym}{total.toFixed(2)}</Text>
          </View>
          {notes ? <Text style={styles.previewNotes}>{notes}</Text> : null}
          <Text style={styles.previewBrand}>Free Invoice Maker | cnxt to invoices</Text>
        </View>
      )}

      <Pressable style={styles.button} onPress={downloadInvoice} disabled={exporting}>
        {exporting ? <ActivityIndicator color="#fffdf8" /> : <Text style={styles.buttonLabel}>Download invoice</Text>}
      </Pressable>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f4f1ea" },
  inner: { padding: 20, paddingTop: 56, gap: 10 },
  userEmail: { fontSize: 12, color: "#675f58" },
  autoSaveStatus: { fontSize: 12, color: "#0d6b61" },
  newInvoiceBtn: { backgroundColor: "#0d6b61", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, alignSelf: "flex-start" },
  newInvoiceBtnLabel: { color: "#fffdf8", fontSize: 13, fontWeight: "700" },
  sectionTitle: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5, color: "#1f1a17", marginTop: 12, marginBottom: 2 },
  input: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#d8cfc3", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 11, fontSize: 14, color: "#1f1a17" },
  textarea: { minHeight: 72, textAlignVertical: "top" },
  currencyRow: { flexDirection: "row", gap: 8 },
  currencyChip: { borderWidth: 1, borderColor: "#d8cfc3", borderRadius: 8, paddingHorizontal: 14, paddingVertical: 8, backgroundColor: "#fffdf8" },
  currencyChipActive: { backgroundColor: "#0d6b61", borderColor: "#0d6b61" },
  currencyLabel: { fontSize: 13, color: "#675f58", fontWeight: "600" },
  currencyLabelActive: { color: "#fffdf8" },
  twoUp: { flexDirection: "row", gap: 10 },
  twoUpField: { flex: 1 },
  lineItem: { gap: 6 },
  lineRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  lineQty: { width: 60 },
  lineRate: { width: 90 },
  lineTotal: { fontSize: 14, fontWeight: "600", color: "#1f1a17", minWidth: 60, textAlign: "right" },
  removeBtn: { padding: 6 },
  removeBtnLabel: { color: "#c0392b", fontSize: 16 },
  addItemBtn: { paddingVertical: 10, alignSelf: "flex-start" },
  addItemLabel: { color: "#0d6b61", fontSize: 14, fontWeight: "600" },
  notesInput: { minHeight: 80, textAlignVertical: "top" },
  totalsBlock: { borderTopWidth: 1, borderTopColor: "#d8cfc3", paddingTop: 10, gap: 4 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingVertical: 3 },
  totalRowFinal: { borderTopWidth: 1, borderTopColor: "#1f1a17", marginTop: 4, paddingTop: 8 },
  subLabel: { fontSize: 13, color: "#675f58" },
  subAmt: { fontSize: 13, color: "#675f58" },
  totalLabel: { fontSize: 16, fontWeight: "700", color: "#1f1a17" },
  totalAmount: { fontSize: 18, fontWeight: "700", color: "#0d6b61" },
  button: { backgroundColor: "#0d6b61", borderRadius: 12, paddingVertical: 16, alignItems: "center", marginTop: 8 },
  buttonLabel: { color: "#fffdf8", fontSize: 16, fontWeight: "700" },
  spacer: { height: 40 },
  logoPreview: { width: 120, height: 40 },
  logoRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  chooseLogoBtn: { borderWidth: 1, borderColor: "#d8cfc3", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 14, alignSelf: "flex-start", backgroundColor: "#fffdf8" },
  chooseLogoBtnLabel: { color: "#1f1a17", fontSize: 13, fontWeight: "500" },
  removeLogoBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  removeLogoBtnLabel: { color: "#c0392b", fontSize: 12 },
  saveProfileBtn: { borderWidth: 1, borderColor: "#0d6b61", borderRadius: 10, paddingVertical: 10, paddingHorizontal: 16, alignSelf: "flex-start" },
  saveProfileBtnLabel: { color: "#0d6b61", fontSize: 13, fontWeight: "600" },
  previewToggle: { borderWidth: 1, borderColor: "#0d6b61", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 16, alignItems: "center", marginTop: 8 },
  previewToggleLabel: { color: "#0d6b61", fontSize: 14, fontWeight: "600" },
  previewCard: { backgroundColor: "#fffdf8", borderWidth: 1, borderColor: "#d8cfc3", borderRadius: 12, padding: 16, gap: 4 },
  previewHeaderRow: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  previewLogo: { width: 100, height: 30, marginBottom: 4 },
  previewTitle: { fontSize: 20, fontWeight: "700", color: "#1f1a17" },
  previewMeta: { fontSize: 12, color: "#675f58", marginTop: 2 },
  previewParties: { flexDirection: "row", gap: 24, marginBottom: 12 },
  previewParty: { flex: 1, gap: 2 },
  previewPartyLabel: { fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "#9a8f87", marginBottom: 2 },
  previewPartyName: { fontSize: 13, fontWeight: "600", color: "#1f1a17" },
  previewPartySub: { fontSize: 12, color: "#675f58" },
  previewDivider: { height: 1, backgroundColor: "#d8cfc3", marginVertical: 8 },
  previewItemsHeader: { flexDirection: "row", marginBottom: 4 },
  previewItemCol: { fontSize: 9, letterSpacing: 1, textTransform: "uppercase", color: "#9a8f87", fontWeight: "600" },
  previewItemRow: { flexDirection: "row", paddingVertical: 4, borderBottomWidth: 1, borderBottomColor: "#f0ebe3" },
  previewItemText: { fontSize: 12, color: "#1f1a17" },
  previewTotRow: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 2 },
  previewTotLabel: { fontSize: 12, color: "#675f58" },
  previewTotVal: { fontSize: 12, color: "#675f58" },
  previewNotes: { marginTop: 8, fontSize: 11, color: "#675f58", fontStyle: "italic" },
  previewBrand: { marginTop: 12, fontSize: 9, letterSpacing: 1.5, textTransform: "uppercase", color: "#9a8f87", textAlign: "center" },
});
