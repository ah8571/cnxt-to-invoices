import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { supabase } from "../lib/supabase";

type LineItem = { description: string; quantity: string; rate: string };

type Props = {
  onSignOut: () => void;
  onViewDrafts?: () => void;
};

function defaultItem(): LineItem {
  return { description: "", quantity: "1", rate: "" };
}

function totalFromItems(items: LineItem[]): number {
  return items.reduce((sum, item) => {
    return sum + (parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0);
  }, 0);
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export default function InvoiceScreen({ onSignOut, onViewDrafts }: Props) {
  const [businessName, setBusinessName] = useState("");
  const [businessEmail, setBusinessEmail] = useState("");
  const [businessPhone, setBusinessPhone] = useState("");
  const [clientName, setClientName] = useState("");
  const [clientEmail, setClientEmail] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("INV-001");
  const [issueDate, setIssueDate] = useState(todayIso());
  const [dueDate, setDueDate] = useState("");
  const [notes, setNotes] = useState("");
  const [items, setItems] = useState<LineItem[]>([defaultItem()]);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    loadProfile();
  }, []);

  async function loadProfile() {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;
    setUserEmail(user.email ?? "");

    const { data } = await supabase
      .from("invoice_business_profiles")
      .select("business_name, email, phone")
      .eq("user_id", user.id)
      .limit(1)
      .single();

    if (data) {
      if (data.business_name) setBusinessName(data.business_name);
      if (data.email) setBusinessEmail(data.email);
      if (data.phone) setBusinessPhone(data.phone);
    }
  }

  function scheduleAutoSave() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveDraft(), 5000);
  }

  async function saveDraft() {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) return;

    const payload = {
      businessName, businessEmail, businessPhone,
      clientName, clientEmail, invoiceNumber,
      issueDate, dueDate, notes,
      items: items.map((i) => ({
        description: i.description,
        quantity: parseFloat(i.quantity) || 1,
        rate: parseFloat(i.rate) || 0,
      })),
    };

    setSaving(true);
    await supabase.from("invoice_drafts").insert({
      user_id: user.id,
      draft_name: invoiceNumber || clientName || "Untitled draft",
      payload_json: payload,
    });
    setSaving(false);
    setStatus("Auto-saved.");
    setTimeout(() => setStatus(""), 3000);
  }

  function updateItem(index: number, field: keyof LineItem, value: string) {
    const updated = items.map((item, i) => i === index ? { ...item, [field]: value } : item);
    setItems(updated);
    scheduleAutoSave();
  }

  function addItem() {
    setItems([...items, defaultItem()]);
  }

  function removeItem(index: number) {
    if (items.length === 1) return;
    setItems(items.filter((_, i) => i !== index));
  }

  const total = totalFromItems(items);

  async function handleSignOut() {
    await supabase.auth.signOut();
    onSignOut();
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
      {/* Header */}
      <View style={styles.topbar}>
        <Text style={styles.brand}>cnxt to invoices</Text>
        <View style={styles.topbarActions}>
          {onViewDrafts && (
            <Pressable onPress={onViewDrafts} style={styles.topbarBtn}>
              <Text style={styles.topbarBtnLabel}>Drafts</Text>
            </Pressable>
          )}
          <Pressable onPress={handleSignOut}>
            <Text style={styles.signOutLink}>Log out</Text>
          </Pressable>
        </View>
      </View>

      {userEmail ? <Text style={styles.userEmail}>{userEmail}</Text> : null}
      {status ? <Text style={styles.autoSaveStatus}>{status}</Text> : null}

      {/* Business */}
      <Text style={styles.sectionTitle}>Your business</Text>
      <TextInput style={styles.input} placeholder="Business name" placeholderTextColor="#9a8f87" value={businessName} onChangeText={(v) => { setBusinessName(v); scheduleAutoSave(); }} />
      <TextInput style={styles.input} placeholder="Business email" placeholderTextColor="#9a8f87" keyboardType="email-address" autoCapitalize="none" value={businessEmail} onChangeText={(v) => { setBusinessEmail(v); scheduleAutoSave(); }} />
      <TextInput style={styles.input} placeholder="Business phone" placeholderTextColor="#9a8f87" keyboardType="phone-pad" value={businessPhone} onChangeText={(v) => { setBusinessPhone(v); scheduleAutoSave(); }} />

      {/* Client */}
      <Text style={styles.sectionTitle}>Client</Text>
      <TextInput style={styles.input} placeholder="Client name" placeholderTextColor="#9a8f87" value={clientName} onChangeText={(v) => { setClientName(v); scheduleAutoSave(); }} />
      <TextInput style={styles.input} placeholder="Client email" placeholderTextColor="#9a8f87" keyboardType="email-address" autoCapitalize="none" value={clientEmail} onChangeText={(v) => { setClientEmail(v); scheduleAutoSave(); }} />

      {/* Invoice meta */}
      <Text style={styles.sectionTitle}>Invoice details</Text>
      <TextInput style={styles.input} placeholder="Invoice number" placeholderTextColor="#9a8f87" value={invoiceNumber} onChangeText={(v) => { setInvoiceNumber(v); scheduleAutoSave(); }} />
      <TextInput style={styles.input} placeholder="Issue date (YYYY-MM-DD)" placeholderTextColor="#9a8f87" value={issueDate} onChangeText={(v) => { setIssueDate(v); scheduleAutoSave(); }} />
      <TextInput style={styles.input} placeholder="Due date (YYYY-MM-DD)" placeholderTextColor="#9a8f87" value={dueDate} onChangeText={(v) => { setDueDate(v); scheduleAutoSave(); }} />

      {/* Line items */}
      <Text style={styles.sectionTitle}>Line items</Text>
      {items.map((item, index) => (
        <View key={index} style={styles.lineItem}>
          <TextInput
            style={[styles.input, styles.lineDesc]}
            placeholder="Description"
            placeholderTextColor="#9a8f87"
            value={item.description}
            onChangeText={(v) => updateItem(index, "description", v)}
          />
          <View style={styles.lineRow}>
            <TextInput
              style={[styles.input, styles.lineQty]}
              placeholder="Qty"
              placeholderTextColor="#9a8f87"
              keyboardType="decimal-pad"
              value={item.quantity}
              onChangeText={(v) => updateItem(index, "quantity", v)}
            />
            <TextInput
              style={[styles.input, styles.lineRate]}
              placeholder="Rate"
              placeholderTextColor="#9a8f87"
              keyboardType="decimal-pad"
              value={item.rate}
              onChangeText={(v) => updateItem(index, "rate", v)}
            />
            <Text style={styles.lineTotal}>
              ${((parseFloat(item.quantity) || 0) * (parseFloat(item.rate) || 0)).toFixed(2)}
            </Text>
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

      {/* Notes */}
      <Text style={styles.sectionTitle}>Notes</Text>
      <TextInput
        style={[styles.input, styles.notesInput]}
        placeholder="Payment terms, bank details, etc."
        placeholderTextColor="#9a8f87"
        multiline
        value={notes}
        onChangeText={(v) => { setNotes(v); scheduleAutoSave(); }}
      />

      {/* Total */}
      <View style={styles.totalRow}>
        <Text style={styles.totalLabel}>Total</Text>
        <Text style={styles.totalAmount}>${total.toFixed(2)}</Text>
      </View>

      {/* Actions */}
      <Pressable style={styles.button} onPress={saveDraft} disabled={saving}>
        {saving ? <ActivityIndicator color="#fffdf8" /> : <Text style={styles.buttonLabel}>Save draft</Text>}
      </Pressable>

      <View style={styles.spacer} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f4f1ea" },
  inner: { padding: 20, paddingTop: 56, gap: 10 },
  topbar: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  brand: { fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#0d6b61" },
  topbarActions: { flexDirection: "row", gap: 16, alignItems: "center" },
  topbarBtn: {},
  topbarBtnLabel: { fontSize: 13, color: "#0d6b61", fontWeight: "600" },
  signOutLink: { fontSize: 13, color: "#675f58" },
  userEmail: { fontSize: 12, color: "#675f58", marginBottom: 8 },
  autoSaveStatus: { fontSize: 12, color: "#0d6b61", marginBottom: 4 },
  sectionTitle: { fontSize: 13, fontWeight: "700", letterSpacing: 0.5, color: "#1f1a17", marginTop: 12, marginBottom: 2 },
  input: {
    backgroundColor: "#fffdf8",
    borderWidth: 1,
    borderColor: "#d8cfc3",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 11,
    fontSize: 14,
    color: "#1f1a17",
  },
  lineItem: { gap: 6 },
  lineDesc: { flex: 1 },
  lineRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  lineQty: { width: 60 },
  lineRate: { width: 90 },
  lineTotal: { fontSize: 14, color: "#1f1a17", minWidth: 60 },
  removeBtn: { padding: 6 },
  removeBtnLabel: { color: "#9b2020", fontSize: 14 },
  addItemBtn: {
    borderWidth: 1,
    borderColor: "#d8cfc3",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  addItemLabel: { color: "#0d6b61", fontSize: 14 },
  notesInput: { minHeight: 80, textAlignVertical: "top" },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 14,
    borderTopWidth: 1,
    borderColor: "#d8cfc3",
    marginTop: 8,
  },
  totalLabel: { fontSize: 16, fontWeight: "700", color: "#1f1a17" },
  totalAmount: { fontSize: 18, fontWeight: "700", color: "#0d6b61" },
  button: {
    backgroundColor: "#0d6b61",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
  },
  buttonLabel: { color: "#fffdf8", fontSize: 15, fontWeight: "600" },
  spacer: { height: 40 },
});
