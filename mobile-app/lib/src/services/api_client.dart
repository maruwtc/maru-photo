import 'dart:convert';

import 'package:http/http.dart' as http;

class ApiClient {
  ApiClient({
    required this.baseUrl,
  });

  final String baseUrl;

  Future<dynamic> get(
    String path, {
    String? accessToken,
  }) {
    return _request(
      'GET',
      path,
      accessToken: accessToken,
    );
  }

  Future<dynamic> post(
    String path, {
    String? accessToken,
    Object? body,
  }) {
    return _request(
      'POST',
      path,
      accessToken: accessToken,
      body: body,
    );
  }

  Future<dynamic> _request(
    String method,
    String path, {
    String? accessToken,
    Object? body,
  }) async {
    final uri = Uri.parse('$baseUrl$path');
    final headers = <String, String>{
      'Content-Type': 'application/json',
    };

    if (accessToken != null && accessToken.isNotEmpty) {
      headers['Authorization'] = 'Bearer $accessToken';
    }

    final request = http.Request(method, uri)
      ..headers.addAll(headers);

    if (body != null) {
      request.body = jsonEncode(body);
    }

    final streamed = await request.send();
    final response = await http.Response.fromStream(streamed);

    dynamic decodedBody;
    if (response.body.isNotEmpty) {
      try {
        decodedBody = jsonDecode(response.body);
      } on FormatException {
        // Server returned non-JSON (e.g. HTML error page or plain text).
        // Treat as a failed request with the raw body as the message.
        throw ApiException(
          statusCode: response.statusCode,
          message: 'Unexpected response from server (status ${response.statusCode}): '
              '${response.body.length > 200 ? '${response.body.substring(0, 200)}…' : response.body}',
        );
      }
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw ApiException(
        statusCode: response.statusCode,
        message: decodedBody is Map<String, dynamic>
            ? (decodedBody['message']?.toString() ?? 'Request failed')
            : 'Request failed',
      );
    }

    return decodedBody;
  }
}

class ApiException implements Exception {
  const ApiException({
    required this.statusCode,
    required this.message,
  });

  final int statusCode;
  final String message;

  @override
  String toString() => 'ApiException($statusCode): $message';
}
