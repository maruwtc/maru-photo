# Mobile App

The mobile app should behave like a backup client, not a storage client.

## Responsibilities

- sign in with Google using Firebase Auth
- send Firebase ID token to your auth server
- request permission to read photos from the device
- detect new local assets
- upload in background with retry and resume
- show gallery using your backend API

## Things the app should never know

- Microsoft tenant details
- Graph tokens
- SharePoint site ids
- OneDrive user account identity

## Backup loop

1. Sign in with Google through Firebase Auth
2. Exchange Firebase ID token at `POST /v1/auth/firebase`
3. Fetch local photo list from the device photo library
4. Compare with server backup cursor or local upload state
5. Call `POST /v1/uploads/initiate`
6. Upload chunks to `PUT /v1/uploads/{uploadId}/chunk`
7. Call `POST /v1/uploads/complete`
8. Mark local asset as backed up

## Suggested technology

- React Native or Flutter for cross-platform MVP
- native background transfer APIs for reliable uploads
- SQLite for local upload queue
- Firebase Auth SDK for Google sign-in

## MVP screens

- sign in
- backup permission onboarding
- backup progress
- photo timeline
- asset detail
