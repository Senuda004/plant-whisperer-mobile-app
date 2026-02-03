import React, { useMemo, useState } from "react";
import {
  View,
  Text,
  Image,
  Pressable,
  ActivityIndicator,
  Alert,
  ScrollView,
  StatusBar,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import * as ImageManipulator from "expo-image-manipulator";

// Backend API endpoint for plant disease prediction
const API_URL = "http://13.62.8.232:5000/predict";

/**
 * HomeScreen component - main interface for plant disease detection
 * Allows users to select leaf images and receive AI-powered diagnosis with visual explanations
 */
export default function HomeScreen() {
  // Selected image URI from device gallery
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  
  // API request loading state
  const [loading, setLoading] = useState(false);

  // Model prediction result (disease name)
  const [prediction, setPrediction] = useState<string | null>(null);
  
  // Model confidence score (0-1 or 0-100)
  const [confidence, setConfidence] = useState<number | null>(null);

  // Grad-CAM visualization as base64 string from API
  const [gradcamBase64, setGradcamBase64] = useState<string | null>(null);

  // Flag to request Grad-CAM heatmap from server
  const includeGradcam = true;

  // Normalize confidence to percentage (0-100) and clamp to valid range
  const confidencePct = useMemo(() => {
    if (confidence === null || Number.isNaN(confidence)) return null;
    const c = confidence > 1 ? confidence : confidence * 100;
    return Math.max(0, Math.min(100, c));
  }, [confidence]);

  // Convert base64 Grad-CAM data to data URI for Image component
  const gradcamUri = useMemo(() => {
    if (!gradcamBase64) return null;
    return `data:image/png;base64,${gradcamBase64}`;
  }, [gradcamBase64]);

  // Format disease labels: replace underscores with spaces and capitalize each word
  const prettyLabel = (s: string) =>
    s.replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

  /**
   * Handle image selection from device gallery
   * Requests permissions, launches picker, and sends selected image to API
   */
  const pickImage = async () => {
    // Request media library permissions
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert("Permission needed", "Please allow photo access.");
      return;
    }

    // Launch image picker with base64 encoding enabled
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.85,
      base64: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];

    // Update UI and clear previous results
    setPickedUri(asset.uri);
    setPrediction(null);
    setConfidence(null);
    setGradcamBase64(null);

    if (!asset.base64) {
      Alert.alert("Error", "Could not read image as base64.");
      return;
    }

    await sendToApi(asset.base64);
  };

  /**
   * Send image to prediction API and handle response
   * @param imageBase64 - Base64 encoded image data
   */
  const sendToApi = async (imageBase64: string) => {
    try {
      setLoading(true);

      // Send POST request with image data and Grad-CAM flag
      const res = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          image: imageBase64,
          include_gradcam: includeGradcam,
        }),
      });

      const data = await res.json();
      
      // Debug logging for Grad-CAM response
      console.log("gradcam head:", data.gradcam_png_base64?.slice(0, 30));
      console.log("gradcam has data uri:", data.gradcam_png_base64?.startsWith("data:image"));
      console.log("gradcam length:", data.gradcam_png_base64?.length);

      // Handle API errors
      if (!res.ok) {
        console.log("API error:", data);
        Alert.alert("API Error", data?.error || "Server error");
        return;
      }

      // Update state with prediction results
      setPrediction(data.prediction ?? null);
      setConfidence(typeof data.confidence === "number" ? data.confidence : null);

      // Store Grad-CAM base64 if present and valid
      if (
        typeof data.gradcam_png_base64 === "string" &&
        data.gradcam_png_base64.length > 0
      ) {
        setGradcamBase64(data.gradcam_png_base64);
      } else {
        setGradcamBase64(null);
      }
    } catch (e: any) {
      // Handle network connectivity errors
      console.log("Network error:", e?.message || e);
      Alert.alert(
        "Network Error",
        "Could not reach the server. Check EC2 IP, port 5000, and that the server is running."
      );
    } finally {
      setLoading(false);
    }
  };

  // Check if prediction results are available for display
  const hasResult = Boolean(prediction) || confidencePct !== null;

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      <StatusBar barStyle="dark-content" backgroundColor="#F8FAFC" />

      {/* Main scrollable content container with consistent padding */}
      <ScrollView
        contentContainerStyle={{
          paddingHorizontal: 16,
          paddingTop: 16,
          paddingBottom: 28,
          gap: 14,
          backgroundColor: "#F8FAFC",
          flexGrow: 1,
        }}
      >
        {/* App title and description */}
        <View style={{ gap: 6 }}>
          <Text style={{ fontSize: 26, fontWeight: "800", color: "#0F172A" }}>
            Plant Whisperer 🌱
          </Text>
          <Text style={{ color: "#475569", lineHeight: 18 }}>
            Upload a leaf photo to get a quick diagnosis + Grad-CAM explainability.
          </Text>
        </View>

        {/* Image upload and preview card */}
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            gap: 12,
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
          }}
        >
          {/* Initial state: image picker button */}
          {!pickedUri ? (
            <Pressable
              onPress={pickImage}
              style={({ pressed }) => ({
                backgroundColor: pressed ? "white" : "white",
                borderRadius: 14,
                paddingVertical: 14,
                alignItems: "center",
                borderColor: "#0B1220",
              })}
            >
              <Text style={{ color: "#0B1220", fontWeight: "700", fontSize: 16 }}>
                Pick an image
              </Text>
              <Text style={{ color: "#0F172A", marginTop: 6, fontSize: 12 }}>
                JPG / PNG • From your gallery
              </Text>
            </Pressable>
          ) : (
            /* After image selected: show preview with replace option */
            <View style={{ gap: 10 }}>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <Text style={{ color: "#0F172A", fontWeight: "700", fontSize: 14 }}>
                  Selected image
                </Text>
                <Pressable onPress={pickImage} hitSlop={10}>
                  <Text style={{ color: "#2563EB", fontWeight: "800" }}>
                    Replace
                  </Text>
                </Pressable>
              </View>

              <Image
                source={{ uri: pickedUri }}
                style={{
                  width: "100%",
                  height: 280,
                  borderRadius: 14,
                  backgroundColor: "#F1F5F9",
                }}
                resizeMode="cover"
              />
            </View>
          )}

          {/* Show loading spinner during API request */}
          {loading && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <ActivityIndicator />
              <Text style={{ color: "#0F172A", fontWeight: "600" }}>
                Running prediction…
              </Text>
            </View>
          )}
        </View>

        {/* Prediction results display card */}
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            gap: 12,
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
            opacity: hasResult ? 1 : 0.95,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 16 }}>
              Result
            </Text>

            {/* Disease label badge */}
            <View
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: "#DCFCE7",
                borderWidth: 1,
                borderColor: "#86EFAC",
              }}
            >
              <Text style={{ color: "#166534", fontWeight: "800", fontSize: 12 }}>
                {prediction ? prettyLabel(prediction) : "—"}
              </Text>
            </View>
          </View>

          {/* Confidence score with progress bar */}
          <View style={{ gap: 8 }}>
            <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
              <Text style={{ color: "#475569", fontWeight: "700" }}>
                Confidence
              </Text>
              <Text style={{ color: "#0F172A", fontWeight: "900" }}>
                {confidencePct === null ? "—" : `${confidencePct.toFixed(0)}%`}
              </Text>
            </View>

            {/* Visual progress bar for confidence percentage */}
            <View
              style={{
                height: 10,
                borderRadius: 999,
                backgroundColor: "#E5E7EB",
                overflow: "hidden",
              }}
            >
              <View
                style={{
                  width: `${confidencePct ?? 0}%`,
                  height: "100%",
                  borderRadius: 999,
                  backgroundColor: "#2563EB",
                }}
              />
            </View>

            <Text style={{ color: "#64748B", fontSize: 12, lineHeight: 16 }}>
              Tip: use a clear leaf close-up with good lighting.
            </Text>
          </View>
        </View>

        {/* Grad-CAM explainability visualization card */}
        <View
          style={{
            backgroundColor: "white",
            borderRadius: 18,
            padding: 14,
            borderWidth: 1,
            borderColor: "#E5E7EB",
            gap: 12,
            shadowColor: "#000",
            shadowOpacity: 0.06,
            shadowRadius: 10,
            shadowOffset: { width: 0, height: 6 },
            elevation: 2,
            opacity: gradcamUri ? 1 : 0.95,
          }}
        >
          <View
            style={{
              flexDirection: "row",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <Text style={{ color: "#0F172A", fontWeight: "800", fontSize: 16 }}>
              Grad-CAM Explainability
            </Text>

            <View
              style={{
                paddingVertical: 6,
                paddingHorizontal: 10,
                borderRadius: 999,
                backgroundColor: "#EFF6FF",
                borderWidth: 1,
                borderColor: "#BFDBFE",
              }}
            >
              <Text style={{ color: "#1D4ED8", fontWeight: "800", fontSize: 12 }}>
                Heatmap
              </Text>
            </View>
          </View>

          {/* Show placeholder or heatmap image based on availability */}
          {!gradcamUri ? (
            <Text style={{ color: "#64748B", lineHeight: 18 }}>
              Pick an image to generate a Grad-CAM heatmap overlay.
            </Text>
          ) : (
            <Image
              source={{ uri: gradcamUri }}
              style={{
                width: "100%",
                height: 280,
                borderRadius: 14,
                backgroundColor: "#F1F5F9",
              }}
              resizeMode="cover"
            />
          )}

          <Text style={{ color: "#64748B", fontSize: 12, lineHeight: 16 }}>
            Grad-CAM highlights regions that influenced the model’s prediction.
          </Text>
        </View>

        {/* Future development note */}
        <Text style={{ color: "#64748B", lineHeight: 18 }}>
          Next: We can save prediction history using Supabase (Storage + Postgres).
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
