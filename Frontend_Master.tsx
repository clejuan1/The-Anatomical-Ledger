import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  UIManager,
  SafeAreaView,
  Image,
  TextInput,
  KeyboardAvoidingView
} from "react-native";
import axios from "axios";
import Animated, {
  LinearTransition,
  FadeIn,
  FadeOut,
  withRepeat,
  withSequence,
  withTiming,
  useSharedValue,
  useAnimatedStyle
} from "react-native-reanimated";
import { Feather } from "@expo/vector-icons";
import { Audio } from "expo-av";

const EXPO_PUBLIC_BACKEND_URL = process.env.EXPO_PUBLIC_BACKEND_URL;

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

// Interfaces
interface LayerItem {
  id: string;
  title: string;
  details: string;
}

interface StageData {
  id: string;
  stage_number: number;
  title: string;
  description: string;
  layers: LayerItem[];
  has_liaison?: boolean;
  has_aw_feed?: boolean;
}

interface RealTimeLink {
  id: string;
  label: string;
  url: string;
  status: string;
}

interface AWLog {
  id: string;
  timestamp: string;
  severity: string;
  message: string;
  source: string;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

// Components
const BlinkingDot = () => {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = withRepeat(
      withSequence(
        withTiming(0.2, { duration: 500 }),
        withTiming(1, { duration: 500 })
      ),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return <Animated.View style={[styles.dot, animatedStyle]} />;
};

const AccordionLayer = ({ layer }: { layer: LayerItem }) => {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.layerContainer}>
      <TouchableOpacity
        style={styles.layerHeader}
        onPress={() => setExpanded(!expanded)}
        activeOpacity={0.7}
      >
        <Text style={styles.layerTitle}>{layer.title}</Text>
        <Feather name={expanded ? "minus" : "plus"} size={16} color="#EAEAEA" />
      </TouchableOpacity>
      {expanded && (
        <Animated.View
          entering={FadeIn}
          exiting={FadeOut}
          layout={LinearTransition}
          style={styles.layerDetailsContainer}
        >
          <Text style={styles.layerDetails}>{layer.details}</Text>
        </Animated.View>
      )}
    </View>
  );
};

// Liaison Chat Component
const PublicLiaison = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', role: 'assistant', content: 'Greetings. I am The Public Liaison. How may I assist you with the WE ARE WISDOM Genesis Protocol today?' }
  ]);
  const [inputText, setInputText] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const scrollViewRef = useRef<ScrollView>(null);
  // generate a fake session id for this user session
  const [sessionId] = useState(() => Math.random().toString(36).substring(7));

  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    const userMsg: ChatMessage = { id: Date.now().toString(), role: 'user', content: inputText.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInputText("");
    setIsTyping(true);

    try {
      const response = await axios.post(`${EXPO_PUBLIC_BACKEND_URL}/api/liaison/chat`, {
        message: userMsg.content,
        session_id: sessionId
      });
      
      const aiMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: response.data.response 
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error) {
      const errorMsg: ChatMessage = { 
        id: (Date.now() + 1).toString(), 
        role: 'assistant', 
        content: '[ERROR: CONNECTION TO LIAISON NODE FAILED]' 
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  return (
    <View style={styles.liaisonContainer}>
      <View style={styles.liaisonHeader}>
        <Feather name="message-square" size={16} color="#00FF00" />
        <Text style={styles.liaisonTitle}>INTERACTIVE SUPPORT: THE PUBLIC LIAISON</Text>
      </View>
      <ScrollView 
        ref={scrollViewRef}
        style={styles.chatScroll}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
      >
        {messages.map(msg => (
          <View key={msg.id} style={[styles.chatBubble, msg.role === 'user' ? styles.userBubble : styles.aiBubble]}>
            <Text style={styles.chatRole}>{msg.role === 'user' ? 'GUEST:' : 'LIAISON:'}</Text>
            <Text style={styles.chatText}>{msg.content}</Text>
          </View>
        ))}
        {isTyping && (
          <View style={[styles.chatBubble, styles.aiBubble]}>
            <Text style={styles.chatRole}>LIAISON:</Text>
            <ActivityIndicator size="small" color="#00FF00" style={{alignSelf: 'flex-start'}}/>
          </View>
        )}
      </ScrollView>
      <View style={styles.inputContainer}>
        <TextInput
          style={styles.chatInput}
          value={inputText}
          onChangeText={setInputText}
          placeholder="Inquire about Resonance..."
          placeholderTextColor="#444"
          onSubmitEditing={sendMessage}
        />
        <TouchableOpacity style={styles.sendButton} onPress={sendMessage}>
          <Feather name="send" size={16} color="#000" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

// AW Feed Component
const AWFeed = () => {
  const [logs, setLogs] = useState<AWLog[]>([]);

  useEffect(() => {
    const fetchLogs = async () => {
      try {
        const res = await axios.get(`${EXPO_PUBLIC_BACKEND_URL}/api/aw/logs`);
        setLogs(res.data);
      } catch (e) {
        console.log("Error fetching AW logs", e);
      }
    };
    
    fetchLogs();
    const interval = setInterval(fetchLogs, 5000); // poll every 5 seconds
    return () => clearInterval(interval);
  }, []);

  return (
    <View style={styles.awFeedContainer}>
      <View style={styles.awFeedHeader}>
        <Feather name="eye" size={16} color="#FF3333" />
        <Text style={styles.awFeedTitle}>SOVEREIGN OVERSIGHT: W8W LEDGER</Text>
      </View>
      <ScrollView style={styles.awScroll} nestedScrollEnabled={true}>
        {logs.map(log => (
          <View key={log.id} style={styles.logRow}>
            <Text style={styles.logTime}>[{new Date(log.timestamp).toLocaleTimeString()}]</Text>
            <Text style={[styles.logSeverity, log.severity === 'CRITICAL' ? {color: '#FF3333'} : {}]}>{log.severity}</Text>
            <Text style={styles.logSource}>&lt;{log.source}&gt;</Text>
            <Text style={styles.logMessage}>{log.message}</Text>
          </View>
        ))}
      </ScrollView>
    </View>
  );
};


const StageCard = ({ stage }: { stage: StageData }) => {
  return (
    <Animated.View style={styles.stageCard} layout={LinearTransition}>
      <View style={styles.stageHeader}>
        <Text style={styles.stageNumber}>STAGE 0{stage.stage_number}</Text>
        <Text style={styles.stageTitle}>// {stage.title}</Text>
      </View>
      <Text style={styles.stageDescription}>{stage.description}</Text>
      
      <View style={styles.layersWrapper}>
        {stage.layers.map((layer) => (
          <AccordionLayer key={layer.id} layer={layer} />
        ))}
      </View>
      
      {stage.has_liaison && <PublicLiaison />}
      {stage.has_aw_feed && <AWFeed />}
    </Animated.View>
  );
};

export default function Index() {
  const [stages, setStages] = useState<StageData[]>([]);
  const [links, setLinks] = useState<RealTimeLink[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Audio State
  const [sound, setSound] = useState<Audio.Sound | null>(null);

  useEffect(() => {
    fetchData();
    playAmbientSound();
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return sound
      ? () => {
          sound.unloadAsync();
        }
      : undefined;
  }, [sound]);

  const fetchData = async () => {
    try {
      const [stagesRes, linksRes] = await Promise.all([
        axios.get(`${EXPO_PUBLIC_BACKEND_URL}/api/stages`),
        axios.get(`${EXPO_PUBLIC_BACKEND_URL}/api/links`),
      ]);
      setStages(stagesRes.data);
      setLinks(linksRes.data);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setLoading(false);
    }
  };

  const playAmbientSound = async () => {
    try {
      // Configure audio session to duck others
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
      });

      const { sound: newSound } = await Audio.Sound.createAsync(
        { uri: 'https://actions.google.com/sounds/v1/science_fiction/humming_background_loop.ogg' },
        { shouldPlay: true, isLooping: true, volume: 0.4 }
      );
      setSound(newSound);
    } catch (error) {
      console.log("Audio auto-playback blocked or error: ", error);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#FFFFFF" />
        <Text style={styles.loadingText}>INITIALIZING WISDOM PROTOCOLS...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{flex: 1}}
      >
        <ScrollView
          style={styles.container}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header */}
          <View style={styles.mainHeader}>
            <View style={styles.logoContainer}>
              <Image 
                source={require('../assets/images/logo.png')} 
                style={styles.logo} 
                resizeMode="contain" 
              />
            </View>
            <View style={styles.headerTopRow}>
              <Text style={styles.mainTitle}>WE ARE WISDOM</Text>
            </View>
            
            <Text style={styles.subTitle}>RESONANCE INFRASTRUCTURE INITIATED</Text>
            <View style={styles.separator} />
            
            <Text style={styles.soundStatusText}>
               [ FREQUENCY HARMONIZED ]
            </Text>
          </View>

          {/* Stages */}
          <View style={styles.stagesContainer}>
            {stages.map((stage) => (
              <StageCard key={stage.id} stage={stage} />
            ))}
          </View>

          {/* Real-Time Links Section */}
          <View style={styles.linksSection}>
            <View style={styles.linksHeader}>
              <BlinkingDot />
              <Text style={styles.linksTitle}>ACTIVE RESONANCE UPLINKS</Text>
            </View>
            <View style={styles.separator} />
            
            {links.map((link) => (
              <TouchableOpacity key={link.id} style={styles.linkItem} activeOpacity={0.6}>
                <View style={styles.linkLeft}>
                  <Feather name="external-link" size={14} color="#A0A0A0" />
                  <Text style={styles.linkLabel}>{link.label}</Text>
                </View>
                <View style={styles.linkRight}>
                  <Text style={[styles.linkStatus, link.status === "LIVE" ? styles.statusLive : null]}>
                    [{link.status}]
                  </Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>END OF FEED</Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#050505",
  },
  container: {
    flex: 1,
    backgroundColor: "#050505",
  },
  contentContainer: {
    padding: 24,
    paddingTop: 40,
    paddingBottom: 60,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: "#050505",
    justifyContent: "center",
    alignItems: "center",
  },
  loadingText: {
    color: "#FFFFFF",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginTop: 16,
    letterSpacing: 2,
    fontSize: 12,
  },
  mainHeader: {
    marginBottom: 40,
  },
  logoContainer: {
    alignItems: "center",
    marginBottom: 20,
  },
  logo: {
    width: 250,
    height: 80,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mainTitle: {
    color: "#FFFFFF",
    fontSize: 28,
    fontFamily: Platform.OS === "ios" ? "Courier-Bold" : "monospace",
    letterSpacing: 4,
    flex: 1,
  },
  subTitle: {
    color: "#A0A0A0",
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 2,
    marginTop: 12,
  },
  soundStatusText: {
    color: "#666666",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 2,
    marginTop: 4,
  },
  separator: {
    height: 1,
    backgroundColor: "#333333",
    marginTop: 16,
    marginBottom: 16,
  },
  stagesContainer: {
    gap: 32,
    marginBottom: 48,
  },
  stageCard: {
    borderWidth: 1,
    borderColor: "#333333",
    padding: 20,
    backgroundColor: "#080808",
  },
  stageHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  stageNumber: {
    color: "#FFFFFF",
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Courier-Bold" : "monospace",
    letterSpacing: 2,
  },
  stageTitle: {
    color: "#EAEAEA",
    fontSize: 16,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
    marginLeft: 8,
  },
  stageDescription: {
    color: "#808080",
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
    marginBottom: 24,
  },
  layersWrapper: {
    borderTopWidth: 1,
    borderTopColor: "#222222",
  },
  layerContainer: {
    borderBottomWidth: 1,
    borderBottomColor: "#222222",
  },
  layerHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 16,
  },
  layerTitle: {
    color: "#D0D0D0",
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
  },
  layerDetailsContainer: {
    paddingBottom: 16,
    paddingRight: 16,
  },
  layerDetails: {
    color: "#888888",
    fontSize: 13,
    lineHeight: 20,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  liaisonContainer: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#00FF0033",
    backgroundColor: "#050505",
    padding: 16,
  },
  liaisonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#00FF0033",
    paddingBottom: 8,
  },
  liaisonTitle: {
    color: "#00FF00",
    fontFamily: Platform.OS === "ios" ? "Courier-Bold" : "monospace",
    fontSize: 12,
    letterSpacing: 1,
  },
  chatScroll: {
    maxHeight: 200,
    marginBottom: 16,
  },
  chatBubble: {
    marginBottom: 12,
  },
  userBubble: {
    paddingLeft: 16,
  },
  aiBubble: {
    paddingRight: 16,
  },
  chatRole: {
    color: "#555",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginBottom: 4,
  },
  chatText: {
    color: "#DDD",
    fontSize: 13,
    lineHeight: 18,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  chatInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#333",
    backgroundColor: "#111",
    color: "#00FF00",
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    padding: 10,
    fontSize: 13,
  },
  sendButton: {
    backgroundColor: "#00FF00",
    padding: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  awFeedContainer: {
    marginTop: 24,
    borderWidth: 1,
    borderColor: "#FF333333",
    backgroundColor: "#050000",
    padding: 16,
  },
  awFeedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#FF333333",
    paddingBottom: 8,
  },
  awFeedTitle: {
    color: "#FF3333",
    fontFamily: Platform.OS === "ios" ? "Courier-Bold" : "monospace",
    fontSize: 12,
    letterSpacing: 1,
  },
  awScroll: {
    maxHeight: 150,
  },
  logRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 6,
  },
  logTime: {
    color: "#555",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginRight: 6,
  },
  logSeverity: {
    color: "#999",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginRight: 6,
  },
  logSource: {
    color: "#A0A0A0",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    marginRight: 6,
  },
  logMessage: {
    color: "#DDD",
    fontSize: 11,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    flex: 1,
  },
  linksSection: {
    borderWidth: 1,
    borderColor: "#333333",
    padding: 20,
    backgroundColor: "#0A0A0A",
  },
  linksHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#FFFFFF",
  },
  linksTitle: {
    color: "#FFFFFF",
    fontSize: 14,
    fontFamily: Platform.OS === "ios" ? "Courier-Bold" : "monospace",
    letterSpacing: 2,
  },
  linkItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
  },
  linkLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  linkLabel: {
    color: "#EAEAEA",
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
  },
  linkRight: {},
  linkStatus: {
    color: "#666666",
    fontSize: 12,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 1,
  },
  statusLive: {
    color: "#FFFFFF",
  },
  footer: {
    marginTop: 48,
    alignItems: "center",
  },
  footerText: {
    color: "#333333",
    fontSize: 10,
    fontFamily: Platform.OS === "ios" ? "Courier" : "monospace",
    letterSpacing: 4,
  },
});
