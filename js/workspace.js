import { getSupabaseClient, isSupabaseConfigured } from "./supabase-client.js";

const STORAGE_KEY = "cnxt-invoices-draft-v2";
const POST_AUTH_RETURN_KEY = "cnxt-invoices-post-auth-return";
const POST_AUTH_ACTION_KEY = "cnxt-invoices-post-auth-action";

const workspaceKind = document.body.dataset.workspaceKind || "drafts";
const subtitle = document.querySelector("#workspace-subtitle");
const refreshButton = document.querySelector("#refresh-workspace");
const list = document.querySelector("#workspace-list");
const headerAuthLink = document.querySelector("#header-auth-link");
const headerSignOutButton = document.querySelector("#header-signout-button");

function setHeaderAuthState(signedIn) {
  if (headerAuthLink) headerAuthLink.classList.toggle("hidden", signedIn);
  if (headerSignOutButton) headerSignOutButton.classList.toggle("hidden", !signedIn);
}

if (headerSignOutButton) {
  headerSignOutButton.addEventListener("click", async () => {
    try {
      const client = await getSupabaseClient();
      await client.auth.signOut();
    } catch {
      // ignore
    }
    window.location.href = "./auth.html";
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatRelativeDate(value) {
  if (!value) {
    return "";
  }

  return new Date(value).toLocaleString([], {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatStoredMoney(cents, currency) {
  const symbols = { USD: "$", EUR: "EUR ", GBP: "GBP ", CAD: "CAD " };
  const symbol = symbols[currency] || `${currency} `;
  return `${symbol}${(Number(cents || 0) / 100).toFixed(2)}`;
}

function redirectToAuth() {
  localStorage.setItem(POST_AUTH_RETURN_KEY, `./${workspaceKind}.html`);
  localStorage.setItem(POST_AUTH_ACTION_KEY, "signin");
  window.location.href = "./auth.html";
}

function loadIntoEditor(payload) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  window.location.href = "./index.html";
}

function showSignedOutState(message) {
  subtitle.textContent = message;
  list.innerHTML = `
    <div class="workspace-empty">
      <p>Sign in to view your ${workspaceKind === "drafts" ? "drafts" : "saved invoices"} across devices.</p>
      <button id="workspace-sign-in" class="button" type="button">Sign in / Sign up</button>
    </div>
  `;

  const signInButton = document.querySelector("#workspace-sign-in");
  signInButton?.addEventListener("click", () => {
    redirectToAuth();
  });
}

function renderDrafts(drafts) {
  list.innerHTML = drafts.length > 0
    ? drafts.map((draft) => `
      <article class="workspace-card">
        <div class="workspace-card-header">
          <div>
            <h3>${escapeHtml(draft.draft_name || "Untitled draft")}</h3>
            <p class="workspace-card-meta">Updated ${escapeHtml(formatRelativeDate(draft.updated_at))}</p>
          </div>
        </div>
        <div class="workspace-card-actions button-row">
          <button class="button workspace-open-draft" type="button" data-draft-id="${draft.id}">Open in editor</button>
        </div>
      </article>
    `).join("")
    : '<div class="workspace-empty">No saved drafts yet.</div>';

  list.querySelectorAll(".workspace-open-draft").forEach((button) => {
    button.addEventListener("click", () => {
      const draft = drafts.find((entry) => entry.id === button.dataset.draftId);
      if (!draft) {
        return;
      }

      loadIntoEditor({ ...draft.payload_json, savedDraftId: draft.id });
    });
  });
}

function renderInvoices(invoices) {
  list.innerHTML = invoices.length > 0
    ? invoices.map((invoice) => `
      <article class="workspace-card">
        <div class="workspace-card-header">
          <div>
            <h3>${escapeHtml(invoice.invoice_number || "Saved invoice")}</h3>
            <p class="workspace-card-meta">${escapeHtml(formatRelativeDate(invoice.issue_date))} · ${escapeHtml(invoice.status || "draft")}</p>
          </div>
          <p>${escapeHtml(formatStoredMoney(invoice.total_cents, invoice.currency || "USD"))}</p>
        </div>
        <p class="workspace-card-copy">Open this invoice in the editor when you need to revise it.</p>
        <div class="workspace-card-actions button-row">
          <button class="button workspace-open-invoice" type="button" data-invoice-id="${invoice.id}">Open in editor</button>
        </div>
      </article>
    `).join("")
    : '<div class="workspace-empty">No saved invoices yet.</div>';

  list.querySelectorAll(".workspace-open-invoice").forEach((button) => {
    button.addEventListener("click", () => {
      const invoice = invoices.find((entry) => entry.id === button.dataset.invoiceId);
      if (!invoice) {
        return;
      }

      loadIntoEditor({
        savedInvoiceId: invoice.id,
        businessName: invoice.business_profile?.business_name || "",
        businessEmail: invoice.business_profile?.email || "",
        businessPhone: invoice.business_profile?.phone || "",
        businessWebsite: invoice.business_profile?.website || "",
        businessAddress: invoice.business_profile?.address_line_1 || "",
        clientName: invoice.client?.client_name || "",
        clientEmail: invoice.client?.email || "",
        clientAddress: invoice.client?.address_line_1 || "",
        invoiceNumber: invoice.invoice_number || "",
        issueDate: invoice.issue_date || "",
        dueDate: invoice.due_date || "",
        currency: invoice.currency || "USD",
        notes: invoice.notes || "",
        items: (invoice.items || []).map((item) => ({
          description: item.description || "",
          quantity: Number(item.quantity || 0),
          rate: Number(item.unit_price_cents || 0) / 100,
        })),
      });
    });
  });
}

async function refreshWorkspacePage() {
  if (!isSupabaseConfigured()) {
    refreshButton.classList.add("hidden");
    setHeaderAuthState(false);
    showSignedOutState("Add Supabase config and sign in to unlock your saved invoice library.");
    return;
  }

  try {
    const client = await getSupabaseClient();
    const { data, error } = await client.auth.getSession();
    const user = data.session?.user;
    if (error || !user) {
      refreshButton.classList.add("hidden");
      setHeaderAuthState(false);
      showSignedOutState("Sign in to access your saved drafts and previous invoices.");
      return;
    }

    refreshButton.classList.remove("hidden");
    setHeaderAuthState(true);
    subtitle.textContent = `Signed in as ${user.email}.`;

    if (workspaceKind === "drafts") {
      const { data: drafts, error: draftsError } = await client
        .from("invoice_drafts")
        .select("id, draft_name, payload_json, updated_at")
        .eq("user_id", user.id)
        .order("updated_at", { ascending: false });

      if (draftsError) {
        throw draftsError;
      }

      renderDrafts(drafts || []);
      return;
    }

    const { data: invoices, error: invoicesError } = await client
      .from("invoices")
      .select(`
        id,
        invoice_number,
        issue_date,
        due_date,
        currency,
        total_cents,
        status,
        notes,
        business_profile:invoice_business_profiles (business_name, email, phone, website, address_line_1),
        client:invoice_clients (client_name, email, address_line_1),
        items:invoice_items (description, quantity, unit_price_cents, sort_order)
      `)
.eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (invoicesError) {
      throw invoicesError;
    }

    renderInvoices(invoices || []);
  } catch (error) {
    subtitle.textContent = error instanceof Error ? error.message : "Unable to load saved items right now.";
    list.innerHTML = '<div class="workspace-empty">Unable to load saved items right now.</div>';
  }
}

refreshButton.addEventListener("click", async () => {
  await refreshWorkspacePage();
});

refreshWorkspacePage();