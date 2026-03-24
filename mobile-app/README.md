# Mobile App

Flutter client scaffold for MaruPhoto.

## Current state

The Flutter app now includes:

- Material 3 / Google-style visual direction
- app shell with Library, Backups, and Account tabs
- Firebase Google sign-in flow wiring
- backend app session exchange
- backend device registration
- Microsoft storage status fetch
- asset list fetch from the auth server
- backup queue UI scaffold

## Not finished yet

- native Firebase platform setup files
- deep-link handling for Microsoft OAuth callback inside Flutter
- file picker and real background upload worker
- local persistence and offline cache
- thumbnail rendering from real asset URLs

## Files

- `pubspec.yaml`
- `lib/main.dart`
- `lib/src/app.dart`
- `lib/src/state/app_controller.dart`
- `lib/src/services/`
- `lib/src/ui/home_shell.dart`

## Next implementation steps

1. run `flutter create .` or create platform folders if they do not exist yet
2. add Firebase platform configuration for Android and iOS
3. add Microsoft OAuth deep-link return handling
4. add file picker and background upload orchestration
5. persist app session and cached assets locally
