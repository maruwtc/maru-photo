import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:workmanager/workmanager.dart';

import 'background_callback.dart';
import 'src/app.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Firebase.initializeApp();

  // Keep more decoded images in memory — default 100 MB is too small for a photo grid.
  PaintingBinding.instance.imageCache.maximumSizeBytes = 300 * 1024 * 1024; // 300 MB

  await Workmanager().initialize(callbackDispatcher);

  runApp(const MaruPhotoApp());
}
