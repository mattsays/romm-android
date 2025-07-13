# RomM Android

<div align="center">
  <img src="./assets/images/icon.png" alt="RomM Android Logo" width="128" height="128" />
  
  <p><strong>A React Native companion app for RomM - ROM Management made easy</strong></p>
  
  [![Expo](https://img.shields.io/badge/Expo-53.0.19-blue.svg)](https://expo.dev/)
  [![React Native](https://img.shields.io/badge/React%20Native-0.79.5-green.svg)](https://reactnative.dev/)
  [![TypeScript](https://img.shields.io/badge/TypeScript-5.8.3-blue.svg)](https://www.typescriptlang.org/)
</div>

## 📱 About

RomM Android is a mobile companion app for [RomM](https://github.com/rommapp/romm), a beautiful, powerful, self-hosted ROM manager. This app allows you to browse, manage, and organize your retro gaming collection directly from your Android device.

### ✨ Features

- 🎮 **Browse ROM Collections**: Explore your games organized by platform
- 🔐 **Secure Authentication**: Login with your RomM server credentials
- 📱 **Retrohandled-Optimized Interface**: Beautiful, responsive design built for retrohandleds
- 📁 **File Management**: Download and manage ROM files on your device

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher)
- [Expo CLI](https://docs.expo.dev/get-started/installation/)
- Android Studio (for Android development)
- A running [RomM server](https://github.com/rommapp/romm)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mattsays/romm-android.git
   cd romm-android
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start the development server**
   ```bash
   npm start
   ```

4. **Run on Android**
   ```bash
   npm run android
   ```

## 🔧 Development

### Project Structure

```
romm-android/
├── app/                    # Expo Router pages
│   ├── auth/              # Authentication screens
│   ├── game/              # Game detail screens
│   └── platform/          # Platform browsing screens
├── components/            # Reusable React components
├── contexts/              # React contexts (AuthContext)
├── hooks/                 # Custom React hooks
├── locales/               # Internationalization files
├── services/              # API services and utilities
└── assets/                # Images, fonts, and static assets
```

### Available Scripts

- `npm start` - Start the Expo development server
- `npm run android` - Run on Android device/emulator

### Technology Stack

- **Framework**: [Expo](https://expo.dev/) with Expo Router
- **Language**: TypeScript
- **UI**: React Native with custom components
- **Navigation**: Expo Router (file-based routing)
- **State Management**: React Context + Custom Hooks
- **Storage**: Expo SecureStore for sensitive data
- **HTTP Client**: Fetch API with custom wrapper
- **Internationalization**: Custom i18n implementation

## 📋 Requirements

### Android Permissions

The app requires the following permissions:
- `READ_EXTERNAL_STORAGE` - Access ROM files
- `WRITE_EXTERNAL_STORAGE` - Download and save ROMs
- `INTERNET` - Connect to RomM server

### RomM Server Compatibility

This app is compatible with RomM API version 3.10.2 and above.

## 🔒 Security

- All authentication tokens are stored securely using Expo SecureStore
- HTTPS connection to RomM server is recommended for production use
- No sensitive data is logged or cached in plain text

## 🤝 Contributing

We welcome contributions! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

### Development Guidelines

1. Follow the existing code style and TypeScript patterns
2. Add appropriate types for all new code
3. Test your changes on both Android devices and emulators
4. Update documentation as needed

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Related Projects

- [RomM](https://github.com/rommapp/romm) - The main RomM server application
- [RomM Documentation](https://github.com/rommapp/romm/wiki) - Official documentation

## 📞 Support

- 🐛 **Bug Reports**: [GitHub Issues](https://github.com/mattsays/romm-android/issues)
- 💬 **Discussions**: [GitHub Discussions](https://github.com/mattsays/romm-android/discussions)
- 📖 **Documentation**: [Wiki](https://github.com/mattsays/romm-android/wiki)

## 🙏 Acknowledgments

- [RomM Team](https://github.com/rommapp/romm) for creating the amazing ROM management platform
- [Expo Team](https://expo.dev/) for the excellent React Native development experience
- The retro gaming community for inspiration and feedback

---

<div align="center">
  <p>Made with ❤️ for the retro gaming community</p>
</div>