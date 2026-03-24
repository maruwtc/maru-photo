import 'package:flutter/material.dart';

import 'config/app_config.dart';
import 'services/api_client.dart';
import 'services/auth_service.dart';
import 'services/upload_service.dart';
import 'state/app_controller.dart';
import 'theme/maru_theme.dart';
import 'ui/home_shell.dart';

class MaruPhotoApp extends StatefulWidget {
  const MaruPhotoApp({super.key});

  @override
  State<MaruPhotoApp> createState() => _MaruPhotoAppState();
}

class _MaruPhotoAppState extends State<MaruPhotoApp> {
  late final AppController _controller;

  @override
  void initState() {
    super.initState();
    final apiClient = ApiClient(baseUrl: AppConfig.apiBaseUrl);
    _controller = AppController(
      authService: AuthService(apiClient: apiClient),
      uploadService: UploadService(apiClient: apiClient),
    )..bootstrap();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        return MaterialApp(
          title: 'MaruPhoto',
          debugShowCheckedModeBanner: false,
          theme: buildMaruTheme(),
          home: HomeShell(controller: _controller),
        );
      },
    );
  }
}
