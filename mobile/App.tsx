import AsyncStorage from "@react-native-async-storage/async-storage";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

type DraftLineItem = {
  id: string;
  description: string;
  quantity: string;
  rate: string;
};

type InvoiceDraft = {
  id: string | null;
  businessName: string;
  businessEmail: string;
  clientName: string;
  clientEmail: string;
  invoiceNumber: string;
  issueDate: string;
  notes: string;
  items: DraftLineItem[];
};

type SavedDraft = {
  id: string;
  name: string;
  updatedAt: string;
  payload: InvoiceDraft;
};

type AppTab = "create" | "drafts" | "account";

const CURRENT_DRAFT_KEY = "cnxt-mobile-current-draft";
const SAVED_DRAFTS_KEY = "cnxt-mobile-saved-drafts";

function createEmptyDraft(): InvoiceDraft {
  return {
    id: null,
    businessName: "",
    businessEmail: "",
    clientName: "",
    clientEmail: "",
    invoiceNumber: "",
    issueDate: "",
    notes: "",
    items: [{ id: `${Date.now()}`, description: "", quantity: "1", rate: "0" }],
  };
}

function money(value: number) {
  return `$${value.toFixed(2)}`;
}

function draftLabel(draft: InvoiceDraft) {
  return draft.invoiceNumber || draft.clientName || draft.businessName || "Untitled draft";
}

export default function App() {
  const [activeTab, setActiveTab] = useState<AppTab>("create");
  const [draft, setDraft] = useState<InvoiceDraft>(createEmptyDraft());
  const [savedDrafts, setSavedDrafts] = useState<SavedDraft[]>([]);
  const [status, setStatus] = useState("Draft auto-saves on this device.");
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    async function loadStorage() {
      try {
        const [storedCurrentDraft, storedDrafts] = await Promise.all([
          AsyncStorage.getItem(CURRENT_DRAFT_KEY),
          AsyncStorage.getItem(SAVED_DRAFTS_KEY),
        ]);

        if (storedCurrentDraft) {
          setDraft(JSON.parse(storedCurrentDraft) as InvoiceDraft);
        }
        if (storedDrafts) {
          setSavedDrafts(JSON.parse(storedDrafts) as SavedDraft[]);
        }
      } catch {
        setStatus("Unable to restore local drafts.");
      } finally {
        setBooted(true);
      }
    }

    loadStorage();
  }, []);

  useEffect(() => {
    if (!booted) {
      return;
    }

    AsyncStorage.setItem(CURRENT_DRAFT_KEY, JSON.stringify(draft)).catch(() => {
      setStatus("Unable to save the in-progress draft.");
    });
  }, [booted, draft]);

  useEffect(() => {
    if (!booted) {
      return;
    }

    AsyncStorage.setItem(SAVED_DRAFTS_KEY, JSON.stringify(savedDrafts)).catch(() => {
      setStatus("Unable to update saved drafts.");
    });
  }, [booted, savedDrafts]);

  const subtotal = draft.items.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const rate = Number(item.rate || 0);
    return sum + quantity * rate;
  }, 0);

  function updateField<Key extends keyof InvoiceDraft>(key: Key, value: InvoiceDraft[Key]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateItem(itemId: string, field: keyof DraftLineItem, value: string) {
    setDraft((current) => ({
      ...current,
      items: current.items.map((item) => (item.id === itemId ? { ...item, [field]: value } : item)),
    }));
  }

  function addItem() {
    setDraft((current) => ({
      ...current,
      items: [...current.items, { id: `${Date.now()}-${current.items.length}`, description: "", quantity: "1", rate: "0" }],
    }));
  }

  function removeItem(itemId: string) {
    setDraft((current) => {
      if (current.items.length === 1) {
        return current;
      }
      return {
        ...current,
        items: current.items.filter((item) => item.id !== itemId),
      };
    });
  }

  function saveDraftToLibrary() {
    const id = draft.id || `${Date.now()}`;
    const nextDraft: InvoiceDraft = { ...draft, id };

    setDraft(nextDraft);
    setSavedDrafts((current) => {
      const entry: SavedDraft = {
        id,
        name: draftLabel(nextDraft),
        updatedAt: new Date().toISOString(),
        payload: nextDraft,
      };

      const existingIndex = current.findIndex((item) => item.id === id);
      if (existingIndex >= 0) {
        const next = [...current];
        next[existingIndex] = entry;
        return next.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
      }

      return [entry, ...current].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    });

    setStatus("Draft saved on this device.");
    setActiveTab("drafts");
  }

  function loadSavedDraft(entry: SavedDraft) {
    setDraft(entry.payload);
    setStatus(`Loaded ${entry.name}.`);
    setActiveTab("create");
  }

  function startFreshDraft() {
    setDraft(createEmptyDraft());
    setStatus("Started a fresh draft.");
    setActiveTab("create");
  }

  function deleteSavedDraft(id: string) {
    setSavedDrafts((current) => current.filter((entry) => entry.id !== id));
    setStatus("Draft removed from this device.");
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />
      <View style={styles.container}>
        <View style={styles.header}>
          <Text style={styles.brand}>cnxt to invoices</Text>
          <Text style={styles.title}>Mobile invoice MVP</Text>
          <Text style={styles.subtitle}>Create an invoice, keep a local draft, and later plug the same flow into Supabase sync.</Text>
        </View>

        <View style={styles.tabRow}>
          {(["create", "drafts", "account"] as AppTab[]).map((tab) => (
            <Pressable
              key={tab}
              onPress={() => setActiveTab(tab)}
              style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
            >
              <Text style={[styles.tabButtonText, activeTab === tab && styles.tabButtonTextActive]}>{tab === "create" ? "Create" : tab === "drafts" ? "Drafts" : "Account"}</Text>
            </Pressable>
          ))}
        </View>

        <Text style={styles.status}>{status}</Text>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {activeTab === "create" ? (
            <View style={styles.stack}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Business</Text>
                <TextInput
                  value={draft.businessName}
                  onChangeText={(value) => updateField("businessName", value)}
                  placeholder="Business name"
                  placeholderTextColor="#7d7c71"
                  style={styles.input}
                />
                <TextInput
                  value={draft.businessEmail}
                  onChangeText={(value) => updateField("businessEmail", value)}
                  placeholder="Business email"
                  placeholderTextColor="#7d7c71"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Client</Text>
                <TextInput
                  value={draft.clientName}
                  onChangeText={(value) => updateField("clientName", value)}
                  placeholder="Client name"
                  placeholderTextColor="#7d7c71"
                  style={styles.input}
                />
                <TextInput
                  value={draft.clientEmail}
                  onChangeText={(value) => updateField("clientEmail", value)}
                  placeholder="Client email"
                  placeholderTextColor="#7d7c71"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={styles.input}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Invoice</Text>
                <TextInput
                  value={draft.invoiceNumber}
                  onChangeText={(value) => updateField("invoiceNumber", value)}
                  placeholder="Invoice number"
                  placeholderTextColor="#7d7c71"
                  style={styles.input}
                />
                <TextInput
                  value={draft.issueDate}
                  onChangeText={(value) => updateField("issueDate", value)}
                  placeholder="Issue date"
                  placeholderTextColor="#7d7c71"
                  style={styles.input}
                />
              </View>

              <View style={styles.card}>
                <View style={styles.inlineHeading}>
                  <Text style={styles.cardTitle}>Line items</Text>
                  <Pressable onPress={addItem} style={styles.secondaryButton}>
                    <Text style={styles.secondaryButtonText}>Add item</Text>
                  </Pressable>
                </View>
                {draft.items.map((item) => {
                  const lineTotal = Number(item.quantity || 0) * Number(item.rate || 0);
                  return (
                    <View key={item.id} style={styles.lineItemCard}>
                      <TextInput
                        value={item.description}
                        onChangeText={(value) => updateItem(item.id, "description", value)}
                        placeholder="Description"
                        placeholderTextColor="#7d7c71"
                        style={styles.input}
                      />
                      <View style={styles.inlineFields}>
                        <TextInput
                          value={item.quantity}
                          onChangeText={(value) => updateItem(item.id, "quantity", value)}
                          placeholder="Qty"
                          placeholderTextColor="#7d7c71"
                          keyboardType="decimal-pad"
                          style={[styles.input, styles.inlineInput]}
                        />
                        <TextInput
                          value={item.rate}
                          onChangeText={(value) => updateItem(item.id, "rate", value)}
                          placeholder="Rate"
                          placeholderTextColor="#7d7c71"
                          keyboardType="decimal-pad"
                          style={[styles.input, styles.inlineInput]}
                        />
                      </View>
                      <View style={styles.lineItemFooter}>
                        <Text style={styles.lineItemTotal}>{money(lineTotal)}</Text>
                        <Pressable onPress={() => removeItem(item.id)} style={styles.textButton}>
                          <Text style={styles.textButtonText}>Remove</Text>
                        </Pressable>
                      </View>
                    </View>
                  );
                })}
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Notes</Text>
                <TextInput
                  value={draft.notes}
                  onChangeText={(value) => updateField("notes", value)}
                  placeholder="Payment notes or project details"
                  placeholderTextColor="#7d7c71"
                  multiline
                  style={[styles.input, styles.notesInput]}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Preview</Text>
                <Text style={styles.previewLine}>{draft.businessName || "Your business"}</Text>
                <Text style={styles.previewLine}>{draft.clientName ? `Bill to ${draft.clientName}` : "Client will appear here"}</Text>
                <Text style={styles.previewLine}>{draft.invoiceNumber ? `Invoice ${draft.invoiceNumber}` : "Add an invoice number when ready"}</Text>
                <Text style={styles.previewTotal}>Total {money(subtotal)}</Text>
              </View>

              <View style={styles.buttonColumn}>
                <Pressable onPress={saveDraftToLibrary} style={styles.primaryButton}>
                  <Text style={styles.primaryButtonText}>Save draft</Text>
                </Pressable>
                <Pressable onPress={startFreshDraft} style={styles.secondaryButtonBlock}>
                  <Text style={styles.secondaryButtonText}>New invoice</Text>
                </Pressable>
              </View>
            </View>
          ) : null}

          {activeTab === "drafts" ? (
            <View style={styles.stack}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Saved drafts</Text>
                <Text style={styles.bodyText}>These drafts are stored locally on the device for the first mobile MVP.</Text>
              </View>
              {savedDrafts.length === 0 ? (
                <View style={styles.emptyState}>
                  <Text style={styles.emptyStateTitle}>No device drafts yet</Text>
                  <Text style={styles.bodyText}>Save one from the Create tab and it will show up here.</Text>
                </View>
              ) : (
                savedDrafts.map((entry) => (
                  <View key={entry.id} style={styles.card}>
                    <Text style={styles.cardTitle}>{entry.name}</Text>
                    <Text style={styles.bodyText}>Updated {new Date(entry.updatedAt).toLocaleString()}</Text>
                    <View style={styles.buttonRow}>
                      <Pressable onPress={() => loadSavedDraft(entry)} style={styles.secondaryButtonBlock}>
                        <Text style={styles.secondaryButtonText}>Open</Text>
                      </Pressable>
                      <Pressable onPress={() => deleteSavedDraft(entry.id)} style={styles.ghostButton}>
                        <Text style={styles.ghostButtonText}>Delete</Text>
                      </Pressable>
                    </View>
                  </View>
                ))
              )}
            </View>
          ) : null}

          {activeTab === "account" ? (
            <View style={styles.stack}>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>Account sync</Text>
                <Text style={styles.bodyText}>This tab is reserved for the same Supabase auth used on the web app.</Text>
                <Text style={styles.bodyText}>Next step: add sign in, sync local drafts to invoice_drafts, and save finalized invoices to the shared database.</Text>
              </View>
              <View style={styles.card}>
                <Text style={styles.cardTitle}>What already works</Text>
                <Text style={styles.bodyText}>Local autosave, saved drafts, and invoice form editing are live in this scaffold.</Text>
              </View>
            </View>
          ) : null}
        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#f4efe5",
  },
  container: {
    flex: 1,
    backgroundColor: "#f4efe5",
    paddingHorizontal: 18,
  },
  header: {
    paddingTop: 18,
    paddingBottom: 16,
    gap: 6,
  },
  brand: {
    textTransform: "uppercase",
    letterSpacing: 2,
    fontSize: 12,
    color: "#40624a",
    fontWeight: "700",
  },
  title: {
    fontSize: 28,
    lineHeight: 32,
    color: "#233127",
    fontWeight: "700",
  },
  subtitle: {
    color: "#556257",
    lineHeight: 21,
  },
  tabRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 12,
  },
  tabButton: {
    flex: 1,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#b8c3b4",
    paddingVertical: 11,
    alignItems: "center",
    backgroundColor: "#fbf8f1",
  },
  tabButtonActive: {
    backgroundColor: "#294b37",
    borderColor: "#294b37",
  },
  tabButtonText: {
    color: "#516452",
    fontWeight: "600",
  },
  tabButtonTextActive: {
    color: "#fbf8f1",
  },
  status: {
    color: "#516452",
    marginBottom: 12,
  },
  scrollContent: {
    paddingBottom: 28,
  },
  stack: {
    gap: 14,
  },
  card: {
    backgroundColor: "#fbf8f1",
    borderRadius: 24,
    padding: 16,
    gap: 12,
    borderWidth: 1,
    borderColor: "#d8ddd1",
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#233127",
  },
  input: {
    borderWidth: 1,
    borderColor: "#d1d8cb",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    color: "#1e261f",
  },
  notesInput: {
    minHeight: 110,
    textAlignVertical: "top",
  },
  inlineHeading: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  lineItemCard: {
    gap: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dde3d8",
    borderRadius: 18,
    backgroundColor: "#f7f4ec",
  },
  inlineFields: {
    flexDirection: "row",
    gap: 10,
  },
  inlineInput: {
    flex: 1,
  },
  lineItemFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  lineItemTotal: {
    fontSize: 16,
    fontWeight: "700",
    color: "#233127",
  },
  textButton: {
    paddingVertical: 6,
    paddingHorizontal: 8,
  },
  textButtonText: {
    color: "#9b4f34",
    fontWeight: "600",
  },
  previewLine: {
    color: "#48594c",
    lineHeight: 20,
  },
  previewTotal: {
    fontSize: 22,
    fontWeight: "700",
    color: "#233127",
  },
  buttonColumn: {
    gap: 10,
  },
  buttonRow: {
    flexDirection: "row",
    gap: 10,
  },
  primaryButton: {
    backgroundColor: "#294b37",
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: "center",
  },
  primaryButtonText: {
    color: "#fbf8f1",
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 12,
    backgroundColor: "#dbe7d9",
  },
  secondaryButtonBlock: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    backgroundColor: "#dbe7d9",
    flex: 1,
  },
  secondaryButtonText: {
    color: "#294b37",
    fontWeight: "700",
  },
  ghostButton: {
    borderRadius: 18,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#e2c8bc",
    backgroundColor: "#fbf3ef",
    flex: 1,
  },
  ghostButtonText: {
    color: "#9b4f34",
    fontWeight: "700",
  },
  emptyState: {
    borderRadius: 24,
    padding: 18,
    borderWidth: 1,
    borderColor: "#d1d8cb",
    borderStyle: "dashed",
    backgroundColor: "#faf7ef",
    gap: 8,
  },
  emptyStateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#233127",
  },
  bodyText: {
    color: "#556257",
    lineHeight: 21,
  },
});
