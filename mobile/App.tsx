import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import AuthScreen from "./screens/AuthScreen";
import DraftsScreen from "./screens/DraftsScreen";
import InvoiceScreen from "./screens/InvoiceScreen";
import InvoicesScreen from "./screens/InvoicesScreen";
import { supabase } from "./lib/supabase";

export type RootStackParamList = {
  Invoice: { draftId?: string; draftPayload?: Record<string, unknown> } | undefined;
  Drafts: undefined;
  Invoices: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  const [session, setSession] = useState<boolean | null>(null); // null = loading

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(Boolean(data.session));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(Boolean(s));
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  if (session === null) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#f4f1ea" }}>
        <ActivityIndicator color="#0d6b61" />
      </View>
    );
  }

  if (!session) {
    return (
      <SafeAreaProvider>
        <AuthScreen onAuthenticated={() => setSession(true)} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <Stack.Navigator
          initialRouteName="Invoice"
          screenOptions={{
            headerStyle: { backgroundColor: "#f4f1ea" },
            headerTintColor: "#0d6b61",
            headerTitleStyle: { fontWeight: "700" },
          }}
        >
          <Stack.Screen
            name="Invoice"
            options={{ headerShown: false }}
          >
            {(props) => {
              const params = props.route.params;
              return (
                <InvoiceScreen
                  onSignOut={() => setSession(false)}
                  onViewDrafts={() => props.navigation.navigate("Drafts")}
                  onViewInvoices={() => props.navigation.navigate("Invoices")}
                  loadDraftId={params?.draftId}
                  loadDraftPayload={params?.draftPayload}
                />
              );
            }}
          </Stack.Screen>
          <Stack.Screen
            name="Drafts"
            options={{ headerShown: false }}
          >
            {(props) => (
              <DraftsScreen
                onOpenDraft={(draft) => props.navigation.navigate("Invoice", { draftId: draft.id, draftPayload: draft.payload_json })}
                onNewInvoice={() => props.navigation.navigate("Invoice")}
                onViewInvoices={() => props.navigation.navigate("Invoices")}
                onSignOut={() => setSession(false)}
              />
            )}
          </Stack.Screen>
          <Stack.Screen
            name="Invoices"
            options={{ headerShown: false }}
          >
            {(props) => (
              <InvoicesScreen
                onNewInvoice={() => props.navigation.navigate("Invoice")}
                onDrafts={() => props.navigation.navigate("Drafts")}
                onSignOut={() => setSession(false)}
              />
            )}
          </Stack.Screen>
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
