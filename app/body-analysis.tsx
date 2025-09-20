import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { BlurView } from 'expo-blur';

import * as Haptics from 'expo-haptics';
import * as ImagePicker from 'expo-image-picker';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
    Alert,
    Animated,
    Clipboard,
    Dimensions,
    Easing,
    KeyboardAvoidingView,
    Linking,
    Platform,
    SafeAreaView,
    ScrollView,
    StatusBar,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { analyzeBodyImage, analyzeProfileBodyTypeFromImage, generatePersonalizedFashionTips, getChatbotResponse } from '../services/geminiService';
import { getUserProfile, updateUserProfile } from '../services/userService';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

// Glassmorphism component
interface GlassCardProps {
    children: React.ReactNode;
    style?: any;
    intensity?: number;
    tint?: 'light' | 'dark' | 'default';
}

const GlassCard = ({ children, style, intensity = 20, tint = 'light' }: GlassCardProps) => {
    if (Platform.OS === 'web') {
        return (
            <View style={[{
                backgroundColor: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(20px)',
                borderRadius: 20,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.2)',
            }, style]}>
                {children}
            </View>
        );
    }

    return (
        <BlurView intensity={intensity} tint={tint} style={[{
            borderRadius: 20,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.2)',
        }, style]}>
            {children}
        </BlurView>
    );
};

interface Message {
    id: string;
    text: string;
    isBot: boolean;
    timestamp: Date;
    type?: 'text' | 'options' | 'image' | 'analysis' | 'video';
    options?: string[];
    data?: any;
}

interface UserData {
    height?: number;
    heightUnit?: 'cm' | 'ft';
    skinTone?: string;
    bodyType?: string;
    gender?: string;
    language?: 'english' | 'hindi' | 'hinglish';
}

const CHATBOT_NAME = "StyleBuddy";

const languages = {
    english: {
        greeting: (time: string, name: string) => `${time}, ${name}! 👋 I'm ${CHATBOT_NAME}, your personal fashion companion! What's on your mind about fashion today?`,
        askHeight: "Let's start with your height! This helps me give you better fashion advice. What's your height?",
        askSkinTone: "Great! Now, what's your skin tone? If you're not sure, you can upload a photo and I'll analyze it for you! 📸",
        askGender: "What's your gender? This helps me provide more personalized fashion tips!",
        analysis: "Perfect! Let me analyze your body type and give you some amazing fashion tips! ✨",
        tips: "Here are some personalized fashion tips just for you! 💫"
    },
    hindi: {
        greeting: (time: string, name: string) => `${time}, ${name}! 👋 मैं ${CHATBOT_NAME} हूं, आपका व्यक्तिगत फैशन साथी! आज फैशन के बारे में आपके मन में क्या है?`,
        askHeight: "आइए आपकी लंबाई से शुरू करते हैं! यह मुझे बेहतर फैशन सलाह देने में मदद करता है। आपकी लंबाई क्या है?",
        askSkinTone: "बहुत बढ़िया! अब, आपका स्किन टोन क्या है? अगर आप निश्चित नहीं हैं, तो आप एक फोटो अपलोड कर सकते हैं और मैं इसका विश्लेषण करूंगा! 📸",
        askGender: "आपका लिंग क्या है? यह मुझे अधिक व्यक्तिगत फैशन टिप्स देने में मदद करता है!",
        analysis: "परफेक्ट! मुझे आपके बॉडी टाइप का विश्लेषण करने दें और आपको कुछ अद्भुत फैशन टिप्स दूं! ✨",
        tips: "यहाँ आपके लिए कुछ व्यक्तिगत फैशन टिप्स हैं! 💫"
    },
    hinglish: {
        greeting: (time: string, name: string) => `${time}, ${name}! 👋 Main ${CHATBOT_NAME} hun, aapka personal fashion companion! Aaj fashion ke baare mein kya soch rahe ho?`,
        askHeight: "Chalo aapki height se start karte hain! Ye mujhe better fashion advice dene mein help karta hai. Aapki height kya hai?",
        askSkinTone: "Great! Ab, aapka skin tone kya hai? Agar sure nahi ho, toh aap ek photo upload kar sakte ho aur main analyze kar dunga! 📸",
        askGender: "Aapka gender kya hai? Ye mujhe zyada personalized fashion tips dene mein help karta hai!",
        analysis: "Perfect! Mujhe aapke body type ka analysis karne do aur aapko kuch amazing fashion tips dun! ✨",
        tips: "Yahan aapke liye kuch personalized fashion tips hain! 💫"
    }
};

export default function BodyAnalysisScreen() {
    const { theme } = useTheme();
    const { user } = useAuth();
    const insets = useSafeAreaInsets();
    const [messages, setMessages] = useState<Message[]>([]);
    const [inputText, setInputText] = useState('');
    const [isTyping, setIsTyping] = useState(false);
    const [currentStep, setCurrentStep] = useState(0);
    const [userData, setUserData] = useState<UserData>({ language: 'english' });
    const [isLoading, setIsLoading] = useState(true);
    const [conversationContext, setConversationContext] = useState<string>('');
    const [isAnalysisComplete, setIsAnalysisComplete] = useState(false);
    const scrollViewRef = useRef<ScrollView>(null);
    const messageCounter = useRef(0);

    // Animation refs
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;
    const headerAnim = useRef(new Animated.Value(-100)).current;
    const floatingAnim = useRef(new Animated.Value(0)).current;
    const pulseAnim = useRef(new Animated.Value(1)).current;
    const typingAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        loadUserData();
        startAnimations();
    }, []);

    // Simple auto-scroll when messages change
    useEffect(() => {
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    }, [messages]);

    useFocusEffect(
        useCallback(() => {
            resetAnimations();
            startAnimations();
            return () => { };
        }, [])
    );

    const resetAnimations = () => {
        fadeAnim.setValue(0);
        slideAnim.setValue(50);
        headerAnim.setValue(-100);
    };

    const startAnimations = () => {
        Animated.sequence([
            Animated.timing(headerAnim, {
                toValue: 0,
                duration: 800,
                easing: Easing.out(Easing.back(1.2)),
                useNativeDriver: true,
            }),
            Animated.parallel([
                Animated.timing(fadeAnim, {
                    toValue: 1,
                    duration: 600,
                    useNativeDriver: true,
                }),
                Animated.timing(slideAnim, {
                    toValue: 0,
                    duration: 600,
                    easing: Easing.out(Easing.quad),
                    useNativeDriver: true,
                }),
            ]),
        ]).start();

        // Continuous animations
        Animated.loop(
            Animated.sequence([
                Animated.timing(floatingAnim, {
                    toValue: 1,
                    duration: 3000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
                Animated.timing(floatingAnim, {
                    toValue: 0,
                    duration: 3000,
                    easing: Easing.inOut(Easing.sin),
                    useNativeDriver: true,
                }),
            ])
        ).start();

        Animated.loop(
            Animated.sequence([
                Animated.timing(pulseAnim, {
                    toValue: 1.05,
                    duration: 2000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
                Animated.timing(pulseAnim, {
                    toValue: 1,
                    duration: 2000,
                    easing: Easing.inOut(Easing.ease),
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    const startTypingAnimation = () => {
        Animated.loop(
            Animated.sequence([
                Animated.timing(typingAnim, {
                    toValue: 1,
                    duration: 500,
                    useNativeDriver: true,
                }),
                Animated.timing(typingAnim, {
                    toValue: 0,
                    duration: 500,
                    useNativeDriver: true,
                }),
            ])
        ).start();
    };

    const loadUserData = async () => {
        try {
            const profile = await getUserProfile();
            if (profile) {
                setUserData(prev => ({
                    ...prev,
                    height: profile.height,
                    heightUnit: profile.height ? 'cm' : undefined,
                    skinTone: profile.skinTone,
                    bodyType: profile.bodyType,
                    gender: profile.gender,
                }));
            }

            // Initialize chat with greeting
            setTimeout(() => {
                initializeChat();
                setIsLoading(false);
            }, 1000);
        } catch (error) {
            console.error('Error loading user data:', error);
            setIsLoading(false);
            initializeChat();
        }
    };

    const initializeChat = () => {
        const currentTime = new Date();
        const hour = currentTime.getHours();
        let greeting = 'Good day';

        if (hour < 12) greeting = 'Good morning';
        else if (hour < 17) greeting = 'Good afternoon';
        else greeting = 'Good evening';

        const userName = user?.displayName || 'Fashion Lover';
        const lang = userData.language || 'english';
        const greetingMessage = languages[lang].greeting(greeting, userName);

        addMessage(greetingMessage, true, 'text');

        // Start the conversation flow
        setTimeout(() => {
            startConversationFlow();
        }, 2000);
    };

    const startConversationFlow = () => {
        // Check what information we already have
        console.log('Starting conversation flow. UserData:', userData);
        if (!userData.height) {
            console.log('Asking for height');
            askForHeight();
        } else if (!userData.skinTone) {
            console.log('Asking for skin tone');
            askForSkinTone();
        } else if (!userData.gender) {
            console.log('Asking for gender');
            askForGender();
        } else if (!userData.bodyType) {
            console.log('Asking for body type analysis');
            askForBodyTypeAnalysis();
        } else {
            console.log('All data available, performing analysis');
            performAnalysis();
        }
    };

    const askForHeight = () => {
        const lang = userData.language || 'english';
        console.log('Asking for height, setting currentStep to 1');
        addMessage(languages[lang].askHeight, true, 'options', ['Enter manually', 'I\'m not sure']);
        setCurrentStep(1);
    };

    const askForHeightUnit = () => {
        const lang = userData.language || 'english';
        const unitMessage = lang === 'hindi'
            ? 'आप अपनी लंबाई किस यूनिट में बताना चाहेंगे? 📏'
            : lang === 'hinglish'
                ? 'Aap apni height kis unit mein batana chahenge? 📏'
                : 'Which unit would you like to use for your height? 📏';

        addMessage(unitMessage, true, 'options', ['Centimeters (cm)', 'Feet & Inches (ft)']);
        setCurrentStep(1.5); // Sub-step for height unit
    };

    const askForBodyTypeAnalysis = () => {
        const lang = userData.language || 'english';
        const gender = userData.gender?.toLowerCase();

        let bodyTypeMessage;
        let options;

        if (gender === 'male') {
            bodyTypeMessage = lang === 'hindi'
                ? 'अब मैं आपके बॉडी टाइप का विश्लेषण करूंगा! पुरुषों के लिए मुख्य बॉडी टाइप हैं: Rectangle, Triangle, Inverted Triangle, Oval। आप अपनी फोटो अपलोड करें या मैन्युअल चुनें? 💪'
                : lang === 'hinglish'
                    ? 'Ab main aapke body type ka analysis karunga! Males ke liye main body types hain: Rectangle, Triangle, Inverted Triangle, Oval. Aap apni photo upload karein ya manual choose karein? 💪'
                    : 'Now let me analyze your body type! For males, the main body types are: Rectangle, Triangle, Inverted Triangle, Oval. Would you like to upload a photo for analysis or choose manually? 💪';

            options = ['📸 Upload Photo for Analysis', '✋ Choose Manually'];
        } else if (gender === 'female') {
            bodyTypeMessage = lang === 'hindi'
                ? 'अब मैं आपके बॉडी टाइप का विश्लेषण करूंगा! महिलाओं के लिए मुख्य बॉडी टाइप हैं: Hourglass, Pear, Apple, Rectangle, Inverted Triangle। आप अपनी फोटो अपलोड करें या मैन्युअल चुनें? 👗'
                : lang === 'hinglish'
                    ? 'Ab main aapke body type ka analysis karunga! Females ke liye main body types hain: Hourglass, Pear, Apple, Rectangle, Inverted Triangle. Aap apni photo upload karein ya manual choose karein? 👗'
                    : 'Now let me analyze your body type! For females, the main body types are: Hourglass, Pear, Apple, Rectangle, Inverted Triangle. Would you like to upload a photo for analysis or choose manually? 👗';

            options = ['📸 Upload Photo for Analysis', '✋ Choose Manually'];
        } else {
            bodyTypeMessage = lang === 'hindi'
                ? 'अब मैं आपके बॉडी टाइप का विश्लेषण करूंगा! मुख्य बॉडी टाइप हैं: Rectangle, Pear, Apple, Hourglass, Triangle, Inverted Triangle। आप अपनी फोटो अपलोड करें या मैन्युअल चुनें? ✨'
                : lang === 'hinglish'
                    ? 'Ab main aapke body type ka analysis karunga! Main body types hain: Rectangle, Pear, Apple, Hourglass, Triangle, Inverted Triangle. Aap apni photo upload karein ya manual choose karein? ✨'
                    : 'Now let me analyze your body type! The main body types are: Rectangle, Pear, Apple, Hourglass, Triangle, Inverted Triangle. Would you like to upload a photo for analysis or choose manually? ✨';

            options = ['📸 Upload Photo for Analysis', '✋ Choose Manually'];
        }

        addMessage(bodyTypeMessage, true, 'options', options);
        setCurrentStep(3.5); // New step for body type analysis
    };

    const askForSkinTone = () => {
        const lang = userData.language || 'english';
        addMessage(languages[lang].askSkinTone, true, 'options', [
            'Fair', 'Wheatish', 'Dusky', 'Dark', 'Upload Photo'
        ]);
        setCurrentStep(2);
    };

    const askForGender = () => {
        const lang = userData.language || 'english';
        addMessage(languages[lang].askGender, true, 'options', ['Male', 'Female', 'Other']);
        setCurrentStep(3);
    };

    const performAnalysis = async () => {
        const lang = userData.language || 'english';
        addMessage(languages[lang].analysis, true, 'text');

        setIsTyping(true);
        startTypingAnimation();

        try {
            // Use the specialized fashion tips function with enhanced body type data
            const response = await generatePersonalizedFashionTips(
                userData.height || 170,
                userData.skinTone || 'Fair',
                userData.bodyType || 'Rectangle', // Default to Rectangle instead of Average
                userData.gender || 'Other',
                lang
            );

            setTimeout(() => {
                setIsTyping(false);
                addMessage(response, true, 'analysis');

                // Ask if user wants YouTube tutorials
                setTimeout(() => {
                    const tutorialMessage = lang === 'hindi'
                        ? 'क्या आप इन फैशन टिप्स के लिए YouTube वीडियो ट्यूटोरियल देखना चाहेंगे? 📺'
                        : lang === 'hinglish'
                            ? 'Kya aap in fashion tips ke liye YouTube video tutorials dekhna chahenge? 📺'
                            : 'Would you like to see YouTube video tutorials for these fashion tips? 📺';

                    addMessage(tutorialMessage, true, 'options', ['Yes, show videos!', 'No, thanks']);
                    setCurrentStep(4); // New step for video tutorials
                }, 1000);

                // Set conversation context for future interactions
                setConversationContext(`User profile: Height: ${userData.height}cm, Skin Tone: ${userData.skinTone}, Gender: ${userData.gender}, Body Type: ${userData.bodyType || 'Rectangle'}. Analysis completed with enhanced body type analysis.`);
                setIsAnalysisComplete(true);

                // Save the updated user data
                updateUserProfile(user?.uid || '', {
                    height: userData.height,
                    skinTone: userData.skinTone,
                    bodyType: userData.bodyType,
                    gender: userData.gender,
                });
            }, 2000);

        } catch (error) {
            console.error('Error getting analysis:', error);
            setIsTyping(false);
            addMessage('Sorry, I encountered an error. Please try again!', true, 'text');
        }
    };

    const addMessage = (text: string, isBot: boolean, type: string = 'text', options?: string[], data?: any) => {
        messageCounter.current += 1;
        const newMessage: Message = {
            id: `msg-${messageCounter.current}-${Date.now()}`,
            text,
            isBot,
            timestamp: new Date(),
            type: type as any,
            options,
            data
        };

        setMessages(prev => [...prev, newMessage]);

        // Simple auto scroll
        setTimeout(() => {
            scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 100);
    };

    const handleSendMessage = async () => {
        console.log('handleSendMessage called with inputText:', inputText);
        if (!inputText.trim()) {
            console.log('Input text is empty, returning');
            return;
        }

        const userMessage = inputText.trim();
        addMessage(userMessage, false, 'text');
        setInputText('');

        // Process based on current step
        await processUserInput(userMessage);
    };

    const processUserInput = async (input: string) => {
        // If analysis is complete, handle as contextual conversation
        if (isAnalysisComplete) {
            setIsTyping(true);
            startTypingAnimation();

            try {
                const contextualPrompt = `
                ${conversationContext}
                
                User's new question/message: "${input}"
                
                Please respond as StyleBuddy in a helpful, contextual way. If they're asking for more fashion advice, provide specific tips based on their profile. If they want clarification on previous advice, explain it better. Keep responses concise and friendly.
                
                Language: ${userData.language || 'english'}
                
                Do not use markdown formatting. Use plain text with emojis only.
                `;

                const response = await getChatbotResponse(contextualPrompt);

                setTimeout(() => {
                    setIsTyping(false);
                    addMessage(response, true, 'text');
                }, 1500);

            } catch (error) {
                console.error('Error getting contextual response:', error);
                setIsTyping(false);
                addMessage('Sorry, I had trouble understanding that. Could you rephrase your question? 😊', true, 'text');
            }
            return;
        }

        // Original flow for data collection
        console.log('Current step:', currentStep, 'Input:', input);
        switch (currentStep) {
            case 1: // Height input
                if (!userData.heightUnit) {
                    // Ask for unit first
                    askForHeightUnit();
                    return;
                }

                let height = 0;
                let heightText = '';

                if (userData.heightUnit === 'cm') {
                    const heightMatch = input.match(/(\d+)/);
                    if (heightMatch) {
                        height = parseInt(heightMatch[1]);
                        heightText = `${height}cm`;
                    }
                } else {
                    // Handle feet input (e.g., "5.7", "5 feet 7", "5'7")
                    const feetMatch = input.match(/(\d+)(?:\.(\d+)|[\s']*feet?\s*(\d+)|'(\d+))/i);
                    if (feetMatch) {
                        const feet = parseInt(feetMatch[1]);
                        const inches = parseInt(feetMatch[2] || feetMatch[3] || feetMatch[4] || '0');
                        height = Math.round((feet * 12 + inches) * 2.54); // Convert to cm
                        heightText = `${feet}'${inches}" (${height}cm)`;
                    } else {
                        const simpleMatch = input.match(/(\d+)\.(\d+)/);
                        if (simpleMatch) {
                            const feet = parseInt(simpleMatch[1]);
                            const decimal = parseInt(simpleMatch[2]);
                            const inches = Math.round(decimal * 12 / 10);
                            height = Math.round((feet * 12 + inches) * 2.54);
                            heightText = `${feet}'${inches}" (${height}cm)`;
                        }
                    }
                }

                if (height > 0) {
                    setUserData(prev => ({ ...prev, height }));
                    addMessage(`Great! I've noted your height as ${heightText}. 📏`, true, 'text');
                    setTimeout(() => askForSkinTone(), 1000);
                } else {
                    const errorMessage = userData.heightUnit === 'cm'
                        ? 'Please enter your height in numbers (e.g., 170)'
                        : 'Please enter your height in feet format (e.g., 5.7 or 5 feet 7 inches)';
                    addMessage(errorMessage, true, 'text');
                }
                break;

            case 2: // Skin tone input
                setUserData(prev => ({ ...prev, skinTone: input }));
                addMessage(`Perfect! I've noted your skin tone. 🌟`, true, 'text');
                setTimeout(() => askForGender(), 1000);
                break;

            case 3: // Gender input
                setUserData(prev => ({ ...prev, gender: input }));
                addMessage(`Thank you! Now I have all the information I need. 💫`, true, 'text');
                setTimeout(() => performAnalysis(), 1500);
                break;

            default:
                // If no step is set, provide a helpful response
                addMessage('I\'m not sure what you\'re asking about. Let me help you get started with your fashion analysis! 😊', true, 'text');
                setTimeout(() => startConversationFlow(), 1000);
                break;
        }
    };

    const handleOptionSelect = async (option: string) => {
        console.log('handleOptionSelect called with option:', option, 'currentStep:', currentStep);
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        addMessage(option, false, 'text');

        switch (currentStep) {
            case 1: // Height options
                console.log('Processing height option:', option);
                if (option === 'Enter manually') {
                    console.log('User selected Enter manually');
                    addMessage('Please type your height in cm (e.g., 170)', true, 'text');
                    // Keep currentStep at 1 so user can input height
                } else {
                    console.log('User selected not sure option');
                    addMessage('No worries! Can you estimate? Most people are between 150-190cm. Just type a number like 170.', true, 'text');
                    // Keep currentStep at 1 so user can input height estimate
                }
                break;

            case 2: // Skin tone options
                if (option === 'Upload Photo' || option === '🔄 Try Photo Again') {
                    handleImageUpload();
                } else {
                    setUserData(prev => ({ ...prev, skinTone: option }));
                    addMessage(`Perfect! I've noted your skin tone as ${option}. 🌟`, true, 'text');
                    setTimeout(() => askForGender(), 1000);
                }
                break;

            case 1.5: // Height unit options
                const unit = option.includes('cm') ? 'cm' : 'ft';
                setUserData(prev => ({ ...prev, heightUnit: unit }));

                const unitConfirmMessage = unit === 'cm'
                    ? 'Great! Please enter your height in centimeters (e.g., 170)'
                    : 'Perfect! Please enter your height in feet and inches (e.g., 5.7 or 5 feet 7 inches)';

                addMessage(unitConfirmMessage, true, 'text');
                setCurrentStep(1); // Go back to height input
                break;

            case 3: // Gender options
                setUserData(prev => ({ ...prev, gender: option }));
                addMessage(`Thank you! Now let's analyze your body type for better fashion recommendations. 💫`, true, 'text');
                setTimeout(() => askForBodyTypeAnalysis(), 1000);
                break;

            case 3.5: // Body type analysis options
                if (option.includes('Upload Photo') || option === '🔄 Try Photo Again') {
                    handleBodyTypeImageUpload();
                } else {
                    // Show manual body type options
                    showManualBodyTypeOptions();
                }
                break;

            case 3.6: // Manual body type selection
                setUserData(prev => ({ ...prev, bodyType: option }));
                const lang = userData.language || 'english';
                const confirmMessage = lang === 'hindi'
                    ? `परफेक्ट! आपका बॉडी टाइप ${option} है। अब मैं आपके लिए व्यक्तिगत फैशन सुझाव तैयार करूंगा! ✨`
                    : lang === 'hinglish'
                        ? `Perfect! Aapka body type ${option} hai. Ab main aapke liye personalized fashion suggestions ready karunga! ✨`
                        : `Perfect! Your body type is ${option}. Now I'll prepare personalized fashion suggestions for you! ✨`;

                addMessage(confirmMessage, true, 'text');
                setTimeout(() => performAnalysis(), 1500);
                break;

            case 4: // Video tutorial options
                if (option === 'Yes, show videos!') {
                    handleVideoRequest();
                } else {
                    const lang = userData.language || 'english';
                    const noVideoMessage = lang === 'hindi'
                        ? 'कोई बात नहीं! आपका फैशन विश्लेषण पूरा हो गया। 🎉\n\nमुझे उम्मीद है कि ये टिप्स आपकी मदद करेंगे। कभी भी फैशन के बारे में सवाल हों तो पूछ सकते हैं!\n\nThank you StyleBuddy का उपयोग करने के लिए! ✨'
                        : lang === 'hinglish'
                            ? 'Koi baat nahi! Aapka fashion analysis complete ho gaya. 🎉\n\nMujhe umeed hai ki ye tips aapki help karenge. Kabhi bhi fashion ke baare mein questions hon toh puch sakte hain!\n\nThank you StyleBuddy use karne ke liye! ✨'
                            : 'No problem! Your fashion analysis is complete. 🎉\n\nI hope these tips will help you look amazing. Feel free to ask me any fashion questions anytime!\n\nThank you for using StyleBuddy! ✨';

                    addMessage(noVideoMessage, true, 'text');

                    // Add final message
                    setTimeout(() => {
                        const finalMessage = lang === 'hindi'
                            ? 'Happy styling! 👗✨'
                            : lang === 'hinglish'
                                ? 'Happy styling! 👗✨'
                                : 'Happy styling! 👗✨';

                        addMessage(finalMessage, true, 'text');
                    }, 1000);
                }
                break;
        }
    };

    const handleImageUpload = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                addMessage('Please grant camera permissions to upload a photo.', true, 'text');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.7,
            });

            if (!result.canceled && result.assets[0]) {
                addMessage('Analyzing your photo... 🔍', true, 'text');
                setIsTyping(true);

                try {
                    const analysis = await analyzeBodyImage(result.assets[0].uri);
                    setIsTyping(false);

                    // Check if the analysis indicates a service overload or error
                    if (analysis.includes('high demand') || analysis.includes('overloaded') || analysis.includes('trouble analyzing')) {
                        // Show the error message from the service and offer retry or manual selection
                        addMessage(analysis, true, 'text');
                        setTimeout(() => {
                            const lang = userData.language || 'english';
                            const retryMessage = lang === 'hindi'
                                ? 'आप फिर से कोशिश कर सकते हैं या मैन्युअल रूप से चुन सकते हैं:'
                                : lang === 'hinglish'
                                    ? 'Aap phir se try kar sakte hain ya manual choose kar sakte hain:'
                                    : 'You can try again or choose manually:';
                            
                            addMessage(retryMessage, true, 'options', [
                                '🔄 Try Photo Again', 'Fair', 'Wheatish', 'Dusky', 'Dark'
                            ]);
                        }, 1000);
                        return;
                    }

                    // Extract skin tone from analysis
                    const skinToneMatch = analysis.match(/skin tone[:\s]*([^.]+)/i);
                    const skinTone = skinToneMatch ? skinToneMatch[1].trim() : 'Fair';

                    setUserData(prev => ({ ...prev, skinTone }));
                    addMessage(analysis, true, 'text'); // Show the full analysis message
                    setTimeout(() => askForGender(), 1000);
                } catch (error) {
                    setIsTyping(false);
                    addMessage('Sorry, I couldn\'t analyze the photo. Please select your skin tone manually.', true, 'options', [
                        'Fair', 'Wheatish', 'Dusky', 'Dark'
                    ]);
                }
            }
        } catch (error) {
            console.error('Error uploading image:', error);
            addMessage('Error uploading image. Please try again or select manually.', true, 'text');
        }
    };

    const changeLanguage = (lang: 'english' | 'hindi' | 'hinglish') => {
        setUserData(prev => ({ ...prev, language: lang }));
        addMessage(`Language changed to ${lang}! 🌍`, true, 'text');
    };

    const showManualBodyTypeOptions = () => {
        const lang = userData.language || 'english';
        const gender = userData.gender?.toLowerCase();

        let options = [];
        let message = '';

        if (gender === 'male') {
            options = ['Rectangle', 'Triangle (Pear)', 'Inverted Triangle', 'Oval (Apple)'];
            message = lang === 'hindi'
                ? 'कृपया अपना बॉडी टाइप चुनें: 💪'
                : lang === 'hinglish'
                    ? 'Please apna body type choose karein: 💪'
                    : 'Please choose your body type: 💪';
        } else if (gender === 'female') {
            options = ['Hourglass', 'Pear', 'Apple', 'Rectangle', 'Inverted Triangle'];
            message = lang === 'hindi'
                ? 'कृपया अपना बॉडी टाइप चुनें: 👗'
                : lang === 'hinglish'
                    ? 'Please apna body type choose karein: 👗'
                    : 'Please choose your body type: 👗';
        } else {
            options = ['Rectangle', 'Pear', 'Apple', 'Hourglass', 'Triangle', 'Inverted Triangle'];
            message = lang === 'hindi'
                ? 'कृपया अपना बॉडी टाइप चुनें: ✨'
                : lang === 'hinglish'
                    ? 'Please apna body type choose karein: ✨'
                    : 'Please choose your body type: ✨';
        }

        addMessage(message, true, 'options', options);
        setCurrentStep(3.6); // Manual body type selection
    };

    const handleBodyTypeImageUpload = async () => {
        try {
            const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (status !== 'granted') {
                addMessage('Please grant camera permissions to upload a photo for body type analysis.', true, 'text');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: true,
                aspect: [3, 4], // Better aspect ratio for body analysis
                quality: 0.8,
            });

            if (!result.canceled && result.assets[0]) {
                const lang = userData.language || 'english';
                const analyzingMessage = lang === 'hindi'
                    ? 'आपकी फोटो का विश्लेषण कर रहा हूं... यह कुछ सेकंड लग सकता है 🔍✨'
                    : lang === 'hinglish'
                        ? 'Aapki photo ka analysis kar raha hun... ye kuch seconds lag sakta hai 🔍✨'
                        : 'Analyzing your photo for body type... this may take a few seconds 🔍✨';

                addMessage(analyzingMessage, true, 'text');
                setIsTyping(true);

                try {
                    // Use the dedicated profile body type analysis function
                    const analysis = await analyzeProfileBodyTypeFromImage(result.assets[0].uri, userData.gender || 'Other');
                    setIsTyping(false);

                    const bodyType = analysis.bodyType;
                    const confidence = analysis.confidence;
                    const analysisText = analysis.analysis;

                    // Check if the analysis failed (confidence = 0 indicates service issues)
                    if (confidence === 0) {
                        // Show the error message from the service and offer retry or manual selection
                        addMessage(analysisText, true, 'text');
                        setTimeout(() => {
                            const retryMessage = lang === 'hindi'
                                ? 'आप फिर से कोशिश कर सकते हैं या मैन्युअल रूप से चुन सकते हैं:'
                                : lang === 'hinglish'
                                    ? 'Aap phir se try kar sakte hain ya manual choose kar sakte hain:'
                                    : 'You can try again or choose manually:';
                            
                            addMessage(retryMessage, true, 'options', [
                                '🔄 Try Photo Again', '✋ Choose Manually'
                            ]);
                        }, 1000);
                        return;
                    }

                    setUserData(prev => ({ ...prev, bodyType }));

                    const resultMessage = lang === 'hindi'
                        ? `बहुत बढ़िया! आपका बॉडी टाइप ${bodyType} है (${confidence}% विश्वास के साथ)। 📸✨\n\n${analysisText}\n\nअब मैं आपके लिए व्यक्तिगत फैशन सुझाव तैयार करूंगा!`
                        : lang === 'hinglish'
                            ? `Bahut badhiya! Aapka body type ${bodyType} hai (${confidence}% confidence ke saath). 📸✨\n\n${analysisText}\n\nAb main aapke liye personalized fashion suggestions ready karunga!`
                            : `Excellent! Your body type is ${bodyType} (${confidence}% confidence). 📸✨\n\n${analysisText}\n\nNow I'll prepare personalized fashion suggestions for you!`;

                    addMessage(resultMessage, true, 'text');
                    setTimeout(() => performAnalysis(), 2000);

                } catch (error) {
                    setIsTyping(false);
                    console.error('Error analyzing body type:', error);

                    const errorMessage = lang === 'hindi'
                        ? 'क्षमा करें, मैं फोटो का विश्लेषण नहीं कर सका। कृपया मैन्युअल रूप से अपना बॉडी टाइप चुनें।'
                        : lang === 'hinglish'
                            ? 'Sorry, main photo ka analysis nahi kar saka. Please manually apna body type choose karein.'
                            : 'Sorry, I couldn\'t analyze the photo. Please choose your body type manually.';

                    addMessage(errorMessage, true, 'text');
                    setTimeout(() => showManualBodyTypeOptions(), 1000);
                }
            }
        } catch (error) {
            console.error('Error uploading image for body type:', error);
            addMessage('Error uploading image. Please try again or select manually.', true, 'text');
            setTimeout(() => showManualBodyTypeOptions(), 1000);
        }
    };



    const handleVideoRequest = async () => {
        const lang = userData.language || 'english';

        const searchingMessage = lang === 'hindi'
            ? 'मैं आपके लिए बेहतरीन फैशन वीडियो खोज रहा हूं... 🔍'
            : lang === 'hinglish'
                ? 'Main aapke liye best fashion videos search kar raha hun... 🔍'
                : 'Searching for the best fashion videos for you... 🔍';

        addMessage(searchingMessage, true, 'text');
        setIsTyping(true);

        try {
            // Create search query based on user data
            const height = userData.height || 170;
            const heightCategory = height > 175 ? 'tall' : height < 160 ? 'petite' : 'average height';
            const skinTone = userData.skinTone?.toLowerCase() || 'fair';
            const gender = userData.gender?.toLowerCase() || 'unisex';

            const searchQuery = `${heightCategory} ${gender} fashion tips ${skinTone} skin tone styling guide`;

            // Generate YouTube video recommendations
            const videoRecommendations = generateVideoRecommendations(searchQuery, lang);

            setTimeout(() => {
                setIsTyping(false);

                const videosMessage = lang === 'hindi'
                    ? 'यहाँ आपके लिए कुछ बेहतरीन फैशन वीडियो हैं! 🎥'
                    : lang === 'hinglish'
                        ? 'Yahan aapke liye kuch best fashion videos hain! 🎥'
                        : 'Here are some great fashion videos for you! 🎥';

                addMessage(videosMessage, true, 'text');

                // Add video recommendations
                videoRecommendations.forEach((video, index) => {
                    setTimeout(() => {
                        addMessage(video, true, 'video');
                    }, (index + 1) * 500);
                });

                // End session after showing all videos
                setTimeout(() => {
                    const endMessage = lang === 'hindi'
                        ? 'यह आपका व्यक्तिगत फैशन विश्लेषण पूरा हुआ! 🎉\n\nमुझे उम्मीद है कि ये टिप्स और वीडियो आपकी मदद करेंगे। अगर आपके कोई और सवाल हैं तो बेझिझक पूछें!\n\nधन्यवाद StyleBuddy का उपयोग करने के लिए! ✨'
                        : lang === 'hinglish'
                            ? 'Yeh aapka personal fashion analysis complete ho gaya! 🎉\n\nMujhe umeed hai ki ye tips aur videos aapki help karenge. Agar aapke koi aur questions hain toh freely puchiye!\n\nThank you StyleBuddy use karne ke liye! ✨'
                            : 'Your personal fashion analysis is complete! 🎉\n\nI hope these tips and videos will help you look and feel amazing. Feel free to ask me any other fashion questions anytime!\n\nThank you for using StyleBuddy! ✨';

                    addMessage(endMessage, true, 'text');

                    // Add a final helpful message
                    setTimeout(() => {
                        const finalMessage = lang === 'hindi'
                            ? 'आप कभी भी वापस आकर नई फैशन सलाह ले सकते हैं। Happy styling! 👗✨'
                            : lang === 'hinglish'
                                ? 'Aap kabhi bhi wapas aakar nayi fashion advice le sakte hain. Happy styling! 👗✨'
                                : 'You can always come back for more fashion advice. Happy styling! 👗✨';

                        addMessage(finalMessage, true, 'text');
                    }, 1500);
                }, (videoRecommendations.length * 500) + 1000);
            }, 2000);

        } catch (error) {
            console.error('Error getting video recommendations:', error);
            setIsTyping(false);
            addMessage('Sorry, I had trouble finding videos. Please try again later! 😊', true, 'text');
        }
    };

    const generateVideoRecommendations = (searchQuery: string, lang: string) => {
        const height = userData.height || 170;
        const skinTone = userData.skinTone || 'Fair';
        const gender = userData.gender || 'Unisex';

        const videos = [
            {
                title: `Fashion Tips for ${height}cm ${gender} with ${skinTone} Skin Tone`,
                channel: 'Style Theory',
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`,
                thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
                description: 'Complete styling guide based on your body measurements and skin tone'
            },
            {
                title: `Best Colors for ${skinTone} Skin Tone - Fashion Guide`,
                channel: 'Color Analysis Studio',
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${skinTone} skin tone best colors fashion`)}`,
                thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
                description: 'Learn which colors complement your skin tone perfectly'
            },
            {
                title: `${height > 175 ? 'Tall' : height < 160 ? 'Petite' : 'Average Height'} ${gender} Fashion Styling Tips`,
                channel: 'Fashion Forward',
                url: `https://www.youtube.com/results?search_query=${encodeURIComponent(`${height > 175 ? 'tall' : height < 160 ? 'petite' : 'average height'} ${gender} fashion tips`)}`,
                thumbnail: 'https://img.youtube.com/vi/dQw4w9WgXcQ/maxresdefault.jpg',
                description: 'Height-specific styling advice to enhance your proportions'
            }
        ];

        return videos.map(video =>
            `🎥 **${video.title}**\n` +
            `📺 Channel: ${video.channel}\n` +
            `📝 ${video.description}\n` +
            `🔗 Watch: ${video.url}\n\n` +
            `Tap the link above to watch on YouTube! 👆`
        );
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 17) return 'Good Afternoon';
        return 'Good Evening';
    };

    const handleCopyMessage = async (text: string) => {
        try {
            Clipboard.setString(text);
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            Alert.alert('Copied!', 'Message copied to clipboard');
        } catch (error) {
            console.error('Error copying to clipboard:', error);
        }
    };

    const handleLinkPress = async (url: string) => {
        try {
            await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            const supported = await Linking.canOpenURL(url);
            if (supported) {
                await Linking.openURL(url);
            } else {
                Alert.alert('Error', 'Cannot open this link');
            }
        } catch (error) {
            console.error('Error opening link:', error);
            Alert.alert('Error', 'Failed to open link');
        }
    };

    const renderTextWithLinks = (text: string, textStyle: any) => {
        // Regex to match URLs
        const urlRegex = /(https?:\/\/[^\s]+)/g;
        const parts = text.split(urlRegex);

        return (
            <Text style={textStyle}>
                {parts.map((part, index) => {
                    if (urlRegex.test(part)) {
                        return (
                            <Text
                                key={`link-${index}`}
                                style={[textStyle, { color: '#4A90E2', textDecorationLine: 'underline' }]}
                                onPress={() => handleLinkPress(part)}
                            >
                                {part}
                            </Text>
                        );
                    }
                    return <Text key={`text-${index}`} style={textStyle}>{part}</Text>;
                })}
            </Text>
        );
    };

    if (isLoading) {
        return (
            <View style={[styles.container, { backgroundColor: theme.background }]}>
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                <View style={styles.loadingContainer}>
                    <Animated.View style={{
                        transform: [{ scale: pulseAnim }]
                    }}>
                        <Ionicons name="chatbubbles-outline" size={60} color={theme.primary} />
                    </Animated.View>
                    <Text style={[styles.loadingText, { color: theme.text }]}>
                        {CHATBOT_NAME} is getting ready...
                    </Text>
                </View>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: theme.background }]}>
            <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

            {/* Gradient Background */}
            <LinearGradient
                colors={[
                    theme.background === '#18181b' ? '#1a1a2e' : '#667eea',
                    theme.background === '#18181b' ? '#16213e' : '#764ba2',
                    theme.background === '#18181b' ? '#0f3460' : '#f093fb'
                ]}
                style={styles.backgroundGradient}
            />

            <SafeAreaView style={[styles.safeArea, { paddingTop: insets.top + 40 }]}>
                {/* Header */}
                <View style={styles.headerContainer}>
                    <View style={styles.headerContent}>
                        <TouchableOpacity
                            onPress={() => router.back()}
                            style={styles.backButton}
                        >
                            <Ionicons name="arrow-back" size={24} color="#fff" />
                        </TouchableOpacity>

                        <View style={styles.headerTitleContainer}>
                            <Text style={styles.headerTitle}>{CHATBOT_NAME}</Text>
                            <Text style={styles.headerSubtitle}>Your Fashion Assistant</Text>
                        </View>

                        <View style={styles.languageSelector}>
                            <TouchableOpacity
                                onPress={() => changeLanguage('english')}
                                style={[
                                    styles.languageButton,
                                    userData.language === 'english' && styles.languageButtonActive
                                ]}
                            >
                                <Text style={[
                                    styles.languageText,
                                    userData.language === 'english' ? styles.languageTextActive : styles.languageTextInactive
                                ]}>EN</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => changeLanguage('hindi')}
                                style={[
                                    styles.languageButton,
                                    userData.language === 'hindi' && styles.languageButtonActive
                                ]}
                            >
                                <Text style={[
                                    styles.languageText,
                                    userData.language === 'hindi' ? styles.languageTextActive : styles.languageTextInactive
                                ]}>हि</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => changeLanguage('hinglish')}
                                style={[
                                    styles.languageButton,
                                    userData.language === 'hinglish' && styles.languageButtonActive
                                ]}
                            >
                                <Text style={[
                                    styles.languageText,
                                    userData.language === 'hinglish' ? styles.languageTextActive : styles.languageTextInactive
                                ]}>HG</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                {/* Chat Messages */}
                <View style={styles.chatContainer}>
                    <ScrollView
                        ref={scrollViewRef}
                        style={styles.messagesContainer}
                        contentContainerStyle={styles.messagesContent}
                        showsVerticalScrollIndicator={false}
                    >

                        {messages.map((message) => (
                            <View
                                key={message.id}
                                style={[
                                    styles.messageContainer,
                                    message.isBot ? styles.botMessageContainer : styles.userMessageContainer
                                ]}
                            >
                                {message.isBot && (
                                    <View style={styles.botAvatar}>
                                        <Ionicons name="sparkles" size={16} color="#fff" />
                                    </View>
                                )}

                                <View
                                    style={[
                                        styles.messageBubble,
                                        message.isBot ? styles.botBubble : styles.userBubble,
                                        message.type === 'video' && styles.videoBubble
                                    ]}
                                >
                                    <Text style={[
                                        styles.messageText,
                                        { color: '#fff' }
                                    ]}>
                                        {message.text}
                                    </Text>

                                    {message.type === 'options' && message.options && (
                                        <View style={styles.optionsContainer}>
                                            {message.options.map((option: string, index: number) => (
                                                <TouchableOpacity
                                                    key={index}
                                                    onPress={() => handleOptionSelect(option)}
                                                    style={styles.optionButton}
                                                >
                                                    <View style={styles.optionGradient}>
                                                        <Text style={styles.optionText}>{option}</Text>
                                                    </View>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}

                                    {message.type === 'video' && (
                                        <View style={styles.videoContainer}>
                                            <View style={styles.videoThumbnail}>
                                                <Ionicons name="play-circle" size={48} color="rgba(255,255,255,0.8)" />
                                            </View>
                                            <TouchableOpacity
                                                style={styles.watchButton}
                                                onPress={() => {
                                                    // Extract URL from message text
                                                    const urlMatch = message.text.match(/https:\/\/[^\s]+/);
                                                    if (urlMatch) {
                                                        handleLinkPress(urlMatch[0]);
                                                    }
                                                }}
                                            >
                                                <Text style={styles.watchButtonText}>Watch on YouTube 📺</Text>
                                            </TouchableOpacity>
                                        </View>
                                    )}
                                </View>

                                <Text style={styles.timestamp}>
                                    {message.timestamp.toLocaleTimeString([], {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </Text>
                            </View>
                        ))}

                        {isTyping && (
                            <View style={styles.typingContainer}>
                                <View style={styles.botAvatar}>
                                    <Ionicons name="sparkles" size={16} color="#fff" />
                                </View>
                                <View style={styles.typingBubble}>
                                    <Text style={styles.typingText}>{CHATBOT_NAME} is typing...</Text>
                                </View>
                            </View>
                        )}
                    </ScrollView>
                </View>

                {/* Input Area */}
                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                    keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
                    style={[styles.inputContainer, { paddingBottom: Math.max(insets.bottom, 20) }]}
                >
                    <GlassCard style={styles.inputCard} intensity={60} tint="light">
                        <View style={styles.inputContent}>
                            <TextInput
                                style={[styles.textInput, { color: theme.text }]}
                                value={inputText}
                                onChangeText={(text) => {
                                    console.log('TextInput onChangeText:', text);
                                    setInputText(text);
                                }}
                                onFocus={() => console.log('TextInput focused')}
                                onBlur={() => console.log('TextInput blurred')}
                                placeholder="Type your height here..."
                                placeholderTextColor="rgba(255,255,255,0.6)"
                                multiline={false}
                                maxLength={500}
                                editable={true}
                                autoFocus={false}
                            />
                            <TouchableOpacity
                                onPress={() => {
                                    console.log('Send button pressed, inputText:', inputText);
                                    handleSendMessage();
                                }}
                                style={[
                                    styles.sendButton,
                                    { opacity: inputText.trim() ? 1 : 0.5 }
                                ]}
                                disabled={!inputText.trim()}
                            >
                                <LinearGradient
                                    colors={['#667eea', '#764ba2']}
                                    style={styles.sendGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                >
                                    <Ionicons name="send" size={20} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        </View>
                    </GlassCard>
                </KeyboardAvoidingView>
            </SafeAreaView>
        </View>
    );
}

// Message Bubble Component
const MessageBubble = ({ message, onOptionSelect, theme, onCopyMessage, onLinkPress, renderTextWithLinks }: any) => {
    const slideAnim = useRef(new Animated.Value(50)).current;
    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.parallel([
            Animated.timing(slideAnim, {
                toValue: 0,
                duration: 300,
                easing: Easing.out(Easing.quad),
                useNativeDriver: true,
            }),
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }),
        ]).start();
    }, []);

    const handleLongPress = async () => {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        Alert.alert(
            'Message Options',
            'What would you like to do?',
            [
                { text: 'Copy Message', onPress: () => onCopyMessage(message.text) },
                { text: 'Cancel', style: 'cancel' }
            ]
        );
    };

    return (
        <Animated.View style={[
            styles.messageContainer,
            message.isBot ? styles.botMessageContainer : styles.userMessageContainer,
            {
                opacity: fadeAnim,
                transform: [{ translateY: slideAnim }]
            }
        ]}>
            {message.isBot && (
                <View style={styles.botAvatar}>
                    <Ionicons name="sparkles" size={16} color="#fff" />
                </View>
            )}

            <TouchableOpacity
                onLongPress={handleLongPress}
                activeOpacity={0.8}
                style={{ flex: 1 }}
            >
                <GlassCard
                    style={[
                        styles.messageBubble,
                        message.isBot ? styles.botBubble : styles.userBubble
                    ]}
                    intensity={message.isBot ? 40 : 60}
                    tint={message.isBot ? 'light' : 'dark'}
                >
                    <View style={styles.messageContent}>
                        {renderTextWithLinks(message.text, [
                            styles.messageText,
                            { color: message.isBot ? '#fff' : '#fff' }
                        ])}

                        {message.isBot && (
                            <TouchableOpacity
                                onPress={() => onCopyMessage(message.text)}
                                style={styles.copyButton}
                            >
                                <Ionicons name="copy-outline" size={16} color="rgba(255,255,255,0.7)" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {message.type === 'options' && message.options && (
                        <View style={styles.optionsContainer}>
                            {message.options.map((option: string, index: number) => (
                                <TouchableOpacity
                                    key={index}
                                    onPress={() => {
                                        console.log('Option pressed:', option);
                                        onOptionSelect(option);
                                    }}
                                    style={styles.optionButton}
                                >
                                    <LinearGradient
                                        colors={['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.1)']}
                                        style={styles.optionGradient}
                                    >
                                        <Text style={styles.optionText}>{option}</Text>
                                    </LinearGradient>
                                </TouchableOpacity>
                            ))}
                        </View>
                    )}
                </GlassCard>
            </TouchableOpacity>

            <Text style={styles.timestamp}>
                {message.timestamp.toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                })}
            </Text>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    safeArea: {
        flex: 1,
        paddingTop: Platform.OS === 'android' ? 40 : 0,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        fontSize: 18,
        fontWeight: '600',
        marginTop: 16,
    },

    // Header Styles
    header: {
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 10,
    },
    headerCard: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    headerInfo: {
        flex: 1,
        alignItems: 'center',
    },
    chatbotName: {
        fontSize: 20,
        fontWeight: '800',
        color: '#fff',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
    chatbotStatus: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        marginTop: 2,
    },
    langButton: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 16,
        marginHorizontal: 2,
    },
    activeLangButton: {
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    langText: {
        fontSize: 12,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
    },
    activeLangText: {
        color: '#fff',
    },

    // Chat Styles
    chatContainer: {
        flex: 1,
        paddingHorizontal: 20,
    },
    messagesContainer: {
        flex: 1,
    },
    messagesContent: {
        paddingVertical: 20,
        paddingBottom: 40,
        minHeight: '100%',
    },
    messageContainer: {
        marginBottom: 16,
        maxWidth: '85%',
    },
    botMessageContainer: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'flex-end',
    },
    userMessageContainer: {
        alignSelf: 'flex-end',
    },
    botAvatar: {
        width: 32,
        height: 32,
        borderRadius: 16,
        backgroundColor: 'rgba(102, 126, 234, 0.8)',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 8,
        marginBottom: 20,
    },
    messageBubble: {
        padding: 16,
        backgroundColor: 'rgba(255,255,255,0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    botBubble: {
        borderBottomLeftRadius: 8,
    },
    userBubble: {
        borderBottomRightRadius: 8,
        backgroundColor: 'rgba(102, 126, 234, 0.3)',
    },
    videoBubble: {
        backgroundColor: 'rgba(220, 38, 38, 0.2)',
        borderColor: 'rgba(220, 38, 38, 0.3)',
        borderWidth: 1,
    },
    messageContent: {
        position: 'relative',
    },
    messageText: {
        fontSize: 16,
        lineHeight: 22,
        fontWeight: '500',
        paddingRight: 30,
    },
    copyButton: {
        position: 'absolute',
        top: 0,
        right: 0,
        padding: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    timestamp: {
        fontSize: 11,
        color: 'rgba(255,255,255,0.6)',
        marginTop: 4,
        textAlign: 'center',
    },

    // Options Styles
    optionsContainer: {
        marginTop: 12,
        gap: 8,
    },
    optionButton: {
        borderRadius: 12,
        overflow: 'hidden',
    },
    optionGradient: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        alignItems: 'center',
    },
    optionText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#fff',
    },

    // Enhanced UI Styles for Modern Look
    avatarGlow: {
        position: 'absolute',
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(102, 126, 234, 0.3)',
        top: -2,
        left: -2,
        zIndex: -1,
    },
    userAvatarGlow: {
        position: 'absolute',
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(102, 126, 234, 0.2)',
        top: -2,
        left: -2,
        zIndex: -1,
    },
    optionShadow: {
        position: 'absolute',
        width: '100%',
        height: '100%',
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.1)',
        top: 2,
        left: 0,
        zIndex: -1,
    },
    analysisContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 4,
    },
    analysisHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        paddingBottom: 8,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    },
    analysisHeaderText: {
        color: '#667eea',
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 8,
    },
    analysisFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 12,
        paddingTop: 8,
        borderTopWidth: 1,
        borderTopColor: 'rgba(255, 255, 255, 0.1)',
    },
    analysisFooterText: {
        color: '#10b981',
        fontSize: 12,
        fontWeight: '500',
        marginLeft: 6,
    },

    // Typing Indicator
    typingContainer: {
        alignSelf: 'flex-start',
        flexDirection: 'row',
        alignItems: 'flex-end',
        marginBottom: 16,
    },
    typingBubble: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        marginLeft: 40,
    },
    typingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
    },
    typingText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.8)',
        fontStyle: 'italic',
    },
    typingDots: {
        marginLeft: 8,
    },
    dotsText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.8)',
        fontWeight: 'bold',
    },

    // Input Styles
    inputContainer: {
        paddingHorizontal: 20,
        paddingBottom: Platform.OS === 'ios' ? 34 : 20,
        paddingTop: 10,
    },
    inputCard: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    inputContent: {
        flexDirection: 'row',
        alignItems: 'flex-end',
        padding: 12,
    },
    textInput: {
        flex: 1,
        fontSize: 16,
        maxHeight: 100,
        paddingHorizontal: 16,
        paddingVertical: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        marginRight: 12,
    },
    sendButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        overflow: 'hidden',
    },
    sendGradient: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },

    // Video Styles
    videoContainer: {
        marginTop: 12,
        borderRadius: 12,
        overflow: 'hidden',
        backgroundColor: 'rgba(0,0,0,0.3)',
    },
    videoThumbnail: {
        height: 120,
        backgroundColor: 'rgba(0,0,0,0.5)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    watchButton: {
        backgroundColor: '#FF0000',
        paddingVertical: 12,
        alignItems: 'center',
    },
    watchButtonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600',
    },

    // New styles for fixed UI
    backgroundGradient: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
    },
    headerContainer: {
        paddingHorizontal: 20,
        paddingVertical: 16,
    },
    headerContent: {
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        padding: 16,
        flexDirection: 'row',
        alignItems: 'center',
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
    },
    headerTitle: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#fff',
    },
    headerSubtitle: {
        fontSize: 14,
        color: 'rgba(255, 255, 255, 0.8)',
    },
    languageSelector: {
        flexDirection: 'row',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: 16,
        padding: 4,
    },
    languageButton: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
    },
    languageButtonActive: {
        backgroundColor: 'rgba(255, 255, 255, 0.3)',
    },
    languageText: {
        fontSize: 12,
        fontWeight: '600',
    },
    languageTextActive: {
        color: '#fff',
    },
    languageTextInactive: {
        color: 'rgba(255, 255, 255, 0.7)',
    },
});