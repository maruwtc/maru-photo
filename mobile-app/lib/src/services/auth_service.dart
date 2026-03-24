import 'package:flutter/services.dart';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../config/app_config.dart';
import '../models/app_models.dart';
import 'api_client.dart';

class AuthService {
  AuthService({
    required ApiClient apiClient,
    FirebaseAuth? firebaseAuth,
    GoogleSignIn? googleSignIn,
  })  : _apiClient = apiClient,
        _firebaseAuth = firebaseAuth ?? FirebaseAuth.instance,
        _googleSignIn = googleSignIn ?? GoogleSignIn();

  final ApiClient _apiClient;
  final FirebaseAuth _firebaseAuth;
  final GoogleSignIn _googleSignIn;

  Future<UserCredential> signInWithGoogle() async {
    try {
      final account = await _googleSignIn.signIn();
      if (account == null) {
        throw const AuthFlowException('Google sign-in was cancelled.');
      }

      final authentication = await account.authentication;
      final credential = GoogleAuthProvider.credential(
        accessToken: authentication.accessToken,
        idToken: authentication.idToken,
      );

      return _firebaseAuth.signInWithCredential(credential);
    } on FirebaseAuthException catch (error) {
      throw AuthFlowException(_mapFirebaseAuthError(error));
    } on PlatformException catch (error) {
      throw AuthFlowException(_mapPlatformError(error));
    } catch (error) {
      if (error is AuthFlowException) {
        rethrow;
      }
      throw AuthFlowException('Google sign-in failed. ${error.toString()}');
    }
  }

  Future<AppSession> exchangeFirebaseToken() async {
    final user = _firebaseAuth.currentUser;
    if (user == null) {
      throw const AuthFlowException('Firebase user is missing');
    }

    final idToken = await user.getIdToken(true);
    final response = await _apiClient.post(
      '/v1/auth/firebase',
      body: {
        'idToken': idToken,
      },
    ) as Map<String, dynamic>;

    return AppSession(
      accessToken: response['accessToken'] as String,
      refreshToken: response['refreshToken'] as String,
      expiresIn: response['expiresIn'] as int,
    );
  }

  Future<DeviceInfo> registerDevice(String accessToken) async {
    final response = await _apiClient.post(
      '/v1/devices',
      accessToken: accessToken,
      body: const {
        'deviceId': AppConfig.deviceId,
        'platform': AppConfig.devicePlatform,
        'appVersion': AppConfig.appVersion,
      },
    ) as Map<String, dynamic>;

    return DeviceInfo(
      id: response['id'] as String,
      deviceId: response['deviceId'] as String,
      platform: response['platform'] as String,
      appVersion: response['appVersion'] as String,
    );
  }

  Future<MicrosoftStatus> fetchMicrosoftStatus(String accessToken) async {
    final response = await _apiClient.get(
      '/v1/microsoft/status',
      accessToken: accessToken,
    ) as Map<String, dynamic>;

    final account = response['account'] as Map<String, dynamic>?;
    return MicrosoftStatus(
      connected: response['connected'] as bool? ?? false,
      email: account?['email'] as String?,
      displayName: account?['displayName'] as String?,
      driveType: account?['driveType'] as String?,
    );
  }

  Future<Uri> buildMicrosoftConnectUrl(String accessToken) async {
    final response = await _apiClient.get(
      '/v1/microsoft/connect-url',
      accessToken: accessToken,
    ) as Map<String, dynamic>;

    return Uri.parse(response['url'] as String);
  }
}

String _mapFirebaseAuthError(FirebaseAuthException error) {
  switch (error.code) {
    case 'network-request-failed':
      return 'Network request failed during sign-in. Check the device internet connection.';
    case 'sign_in_failed':
    case 'invalid-credential':
      return 'Google sign-in failed. Verify Android SHA keys or iOS bundle setup in Firebase.';
    case 'account-exists-with-different-credential':
      return 'This email is already linked with a different sign-in method.';
    case 'user-disabled':
      return 'This Firebase user has been disabled.';
    default:
      return error.message ?? 'Firebase sign-in failed with code ${error.code}.';
  }
}

String _mapPlatformError(PlatformException error) {
  final message = error.message ?? '';
  if (message.contains('10')) {
    return 'Google sign-in returned error code 10. This usually means the Android SHA-1/SHA-256 fingerprint is missing in Firebase.';
  }
  if (message.isNotEmpty) {
    return 'Google sign-in failed. $message';
  }
  return 'Google sign-in failed with platform error ${error.code}.';
}

class AuthFlowException implements Exception {
  const AuthFlowException(this.message);

  final String message;

  @override
  String toString() => message;
}
