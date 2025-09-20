# UpTrends - AI-Powered Fashion Assistant

A React Native app that provides personalized outfit recommendations using Google's Gemini AI, with body-type awareness and venue-specific styling suggestions.

## 🚀 Features

- **Smart Wardrobe Analysis**: Upload your clothes and get AI-powered outfit combinations
- **Body-Type Intelligence**: Personalized recommendations based on height, weight, skin tone, and body type
- **Venue-Specific Styling**: Upload venue photos and get outfit suggestions that match the ambiance
- **Color Harmony Analysis**: AI analyzes venue colors and suggests complementary outfit colors
- **Real-time Profile Integration**: Considers user preferences and physical attributes
- **Rate-Limited API Usage**: Optimized for free tier usage with built-in rate limiting

## 🛡️ Security Features

- Environment variable protection for API keys
- Rate limiting to prevent API quota exhaustion
- Input validation and sanitization
- Secure error handling without exposing sensitive data

## 📱 Screens

1. **Authentication**: Secure login/signup
2. **Home Dashboard**: Navigation to main features
3. **Fashion Explorer**: Browse outfit categories
4. **Upload Aesthetic**: Venue-based outfit suggestions
5. **Make Outfit**: Wardrobe-based outfit generation
6. **Profile Management**: User preferences and body measurements

## 🔧 Setup Instructions

### Prerequisites

- Node.js (v16 or higher)
- Expo CLI
- React Native development environment

### Installation

1. **Clone the repository**
   ```bash
   git clone <your-repo-url>
   cd uptrends
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Environment Setup**
   Create a `.env` file in the root directory:
   ```env
   EXPO_PUBLIC_GEMINI_API_KEY=your_gemini_api_key_here
   ```

4. **Firebase Configuration**
   - Create a Firebase project
   - Enable Authentication and Firestore
   - Download the configuration file
   - Update `firebaseConfig.ts` with your credentials

5. **Start the development server**
   ```bash
   npm start
   ```

## 🔑 Security & API Setup

### 🛡️ Security First
This app implements comprehensive security measures. Before setup, please review our [Security Guide](SECURITY.md).

### Getting API Keys

1. **Gemini API Key**
   - Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
   - Create a new API key
   - The free tier includes:
     - 15 requests per minute
     - 1,500 requests per day
     - 1 million tokens per month

2. **Firebase Configuration**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
   - Enable Authentication and Firestore
   - Get your Firebase configuration values

### 🔒 Secure Environment Setup

1. Copy the environment template:
   ```bash
   cp .env.example .env
   ```

2. Fill in your actual API keys in `.env`:
   ```env
   EXPO_PUBLIC_GEMINI_API_KEY=your_actual_gemini_key
   FIREBASE_API_KEY=your_firebase_api_key
   FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
   # ... other Firebase values
   ```

3. **Validate Security** (Important!):
   ```bash
   node scripts/validate-security.js
   ```

### 🎨 Enhanced Theme System

The app now features a dynamic theme system with:
- **Enhanced Light Mode**: Modern colors, gradients, and dynamic status bar
- **Rich Dark Mode**: Comfortable dark backgrounds with vibrant accents
- **Screen-Specific Colors**: Different accent colors for each screen
- **Dynamic Status Bar**: Changes color based on current screen

### Security Best Practices

- ✅ All credentials secured in environment variables
- ✅ Comprehensive security validation script
- ✅ No hardcoded API keys in source code
- ✅ Proper .gitignore configuration
- ✅ Rate limiting and error handling
- Use HTTPS for all network requests

## 📊 Usage Optimization

The app is optimized for free tier usage:

- **Efficient Prompting**: Minimizes token usage
- **Smart Caching**: Reduces redundant API calls
- **Rate Limiting**: Prevents quota exhaustion
- **Fallback Responses**: Handles API failures gracefully

**Estimated Usage for 3-4 Users:**
- Daily requests: ~15-20
- Monthly requests: ~450-600
- Quota utilization: <1% of free tier

## 🎨 Key Technologies

- **React Native**: Cross-platform mobile development
- **Expo**: Development platform and tools
- **Google Gemini AI**: Advanced AI for image and text analysis
- **Firebase**: Authentication and database
- **TypeScript**: Type-safe development
- **Animated API**: Smooth animations and transitions

## 🧠 AI Intelligence Features

### Body Type Analysis
- **Slim**: Volume-adding layers, horizontal patterns
- **Athletic**: Waist emphasis, softer fabrics
- **Heavy**: Monochromatic looks, vertical lines
- **Average**: Versatile styling options

### Skin Tone Matching
- **Fair**: Pastels, jewel tones, navy
- **Wheatish**: Earth tones, warm colors
- **Dusky**: Rich vibrant colors, jewel tones
- **Dark**: Bright bold colors, high contrast

### Height Considerations
- **Petite**: High-waisted pieces, vertical lines
- **Average**: Balanced proportions
- **Tall**: Longer pieces, horizontal elements

## 🔒 Security Measures

1. **API Key Protection**
   - Environment variables only
   - Validation on startup
   - No hardcoded keys in source

2. **Rate Limiting**
   - 15 calls per minute maximum
   - Automatic throttling
   - User-friendly error messages

3. **Input Validation**
   - Sanitized user inputs
   - Image format validation
   - Prompt length limits

4. **Error Handling**
   - Graceful degradation
   - No sensitive data exposure
   - Fallback responses

## 📝 Development Notes

- All sensitive data is in environment variables
- Rate limiting prevents API quota issues
- Comprehensive error handling for production use
- Optimized for free tier usage patterns
- Ready for GitHub deployment

## 🚀 Deployment

The app is configured for secure deployment:

1. All API keys are in environment variables
2. `.gitignore` excludes sensitive files
3. Rate limiting prevents quota exhaustion
4. Error handling is production-ready

## 📞 Support

For issues or questions:
1. Check the error logs for rate limiting messages
2. Verify environment variables are set correctly
3. Ensure Firebase configuration is complete
4. Monitor API usage in Google Cloud Console

---

**Note**: This app is optimized for small user groups (3-4 people) and will stay well within free tier limits. The AI provides sophisticated fashion advice while maintaining cost efficiency.