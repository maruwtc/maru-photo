import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../models/app_models.dart';
import '../state/app_controller.dart';

class HomeShell extends StatefulWidget {
  const HomeShell({
    super.key,
    required this.controller,
  });

  final AppController controller;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final tabs = [
      _LibraryTab(controller: controller),
      _BackupsTab(controller: controller),
      _AccountTab(controller: controller),
    ];

    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            colors: [
              Color(0xFFEAF6EC),
              Color(0xFFF6F7FC),
            ],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: SafeArea(
          child: controller.isBootstrapping
              ? const Center(child: CircularProgressIndicator())
              : tabs[_tabIndex],
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _tabIndex,
        onDestinationSelected: (index) => setState(() => _tabIndex = index),
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.photo_library_outlined),
            selectedIcon: Icon(Icons.photo_library),
            label: 'Library',
          ),
          NavigationDestination(
            icon: Icon(Icons.cloud_upload_outlined),
            selectedIcon: Icon(Icons.cloud_upload),
            label: 'Backups',
          ),
          NavigationDestination(
            icon: Icon(Icons.account_circle_outlined),
            selectedIcon: Icon(Icons.account_circle),
            label: 'Account',
          ),
        ],
      ),
    );
  }
}

class _LibraryTab extends StatelessWidget {
  const _LibraryTab({
    required this.controller,
  });

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverToBoxAdapter(
          child: _HeroBanner(controller: controller),
        ),
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 120),
          sliver: controller.assets.isEmpty
              ? SliverToBoxAdapter(
                  child: _EmptyLibraryCard(
                    onRefresh: controller.session == null ? null : controller.refreshDashboard,
                  ),
                )
              : SliverGrid(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) => _AssetTile(asset: controller.assets[index]),
                    childCount: controller.assets.length,
                  ),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: 14,
                    crossAxisSpacing: 14,
                    childAspectRatio: 0.78,
                  ),
                ),
        ),
      ],
    );
  }
}

class _BackupsTab extends StatelessWidget {
  const _BackupsTab({
    required this.controller,
  });

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final queue = controller.queue;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
      children: [
        _SectionCard(
          title: 'Backup queue',
          subtitle: 'This screen now supports real foreground file picking and chunked uploads to the current backend. Background workers are still a later step.',
          trailing: FilledButton.icon(
            onPressed: controller.pickFilesForUpload,
            icon: const Icon(Icons.add_photo_alternate_outlined),
            label: const Text('Pick files'),
          ),
          child: queue.isEmpty
              ? const _InlineHint(
                  title: 'No queued uploads',
                  body: 'Tap "Pick files" to choose media from the device, then upload them through the auth server.',
                )
              : Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    FilledButton.icon(
                      onPressed: controller.uploadPendingQueue,
                      icon: const Icon(Icons.cloud_upload_outlined),
                      label: const Text('Upload queued files'),
                    ),
                    const SizedBox(height: 14),
                    for (final item in queue) ...[
                      _QueueTile(item: item),
                      const SizedBox(height: 12),
                    ],
                  ],
                ),
        ),
      ],
    );
  }
}

class _AccountTab extends StatelessWidget {
  const _AccountTab({
    required this.controller,
  });

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final microsoftStatus = controller.microsoftStatus;
    return ListView(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 120),
      children: [
        _SectionCard(
          title: 'App session',
          subtitle: controller.session == null
              ? 'Sign in with Google to create the app session, register the device, and load account state.'
              : 'Signed in as ${controller.firebaseEmail ?? 'Firebase user'}',
          trailing: controller.isSigningIn
              ? Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    const SizedBox(
                      width: 28,
                      height: 28,
                      child: CircularProgressIndicator(strokeWidth: 3),
                    ),
                    const SizedBox(height: 8),
                    SizedBox(
                      width: 150,
                      child: Text(
                        controller.signInStatusMessage ?? 'Working',
                        textAlign: TextAlign.right,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ),
                  ],
                )
              : FilledButton.icon(
                  onPressed: controller.signInFlow,
                  icon: const Icon(Icons.login),
                  label: Text(controller.session == null ? 'Sign in' : 'Re-authenticate'),
                ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _InfoRow(label: 'Firebase email', value: controller.firebaseEmail ?? 'Not available'),
              const SizedBox(height: 10),
              _InfoRow(
                label: 'Sign-in state',
                value: controller.isSigningIn
                    ? (controller.signInStatusMessage ?? 'Working')
                    : (controller.session == null ? 'Signed out' : 'Ready'),
              ),
              const SizedBox(height: 10),
              _InfoRow(label: 'Device', value: controller.deviceInfo?.deviceId ?? 'Not registered'),
              const SizedBox(height: 10),
              _InfoRow(
                label: 'Microsoft storage',
                value: microsoftStatus?.connected == true
                    ? '${microsoftStatus?.displayName ?? 'Connected'} • ${microsoftStatus?.driveType ?? 'business'}'
                    : 'Not connected yet',
              ),
              if (controller.errorMessage != null) ...[
                const SizedBox(height: 16),
                _ErrorBanner(message: controller.errorMessage!),
              ] else if (controller.isSigningIn && controller.signInStatusMessage != null) ...[
                const SizedBox(height: 16),
                _ProgressBanner(message: controller.signInStatusMessage!),
              ],
            ],
          ),
        ),
        const SizedBox(height: 16),
        _SectionCard(
          title: 'Storage connection',
          subtitle: microsoftStatus?.connected == true
              ? 'The backend already sees a linked Microsoft account for this app user.'
              : 'Microsoft connect still needs native deep-link handling in Flutter. The backend flow is already implemented and can be exercised from the mock web app.',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _InfoRow(label: 'Status', value: microsoftStatus?.connected == true ? 'Connected' : 'Pending'),
              const SizedBox(height: 10),
              _InfoRow(label: 'Email', value: microsoftStatus?.email ?? 'Unavailable'),
              const SizedBox(height: 10),
              _InfoRow(label: 'Drive type', value: microsoftStatus?.driveType ?? 'Unavailable'),
              const SizedBox(height: 18),
              OutlinedButton.icon(
                onPressed: controller.session == null ? null : controller.refreshDashboard,
                icon: const Icon(Icons.sync),
                label: const Text('Refresh account state'),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class _HeroBanner extends StatelessWidget {
  const _HeroBanner({
    required this.controller,
  });

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 18, 20, 16),
      child: Card(
        child: Container(
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(28),
            gradient: const LinearGradient(
              colors: [
                Color(0xFFDBF1E2),
                Color(0xFFDCE9FF),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
          ),
          padding: const EdgeInsets.fromLTRB(22, 22, 22, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'MaruPhoto',
                style: theme.textTheme.labelLarge?.copyWith(
                  color: theme.colorScheme.primary,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.1,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'A familiar photo timeline with Firebase sign-in and Microsoft-backed storage.',
                style: theme.textTheme.headlineMedium,
              ),
              const SizedBox(height: 12),
              Text(
                controller.session == null
                    ? 'Sign in to start loading your library and device state.'
                    : '${controller.assets.length} assets available in your current library view.',
                style: theme.textTheme.bodyLarge?.copyWith(
                  color: const Color(0xFF455A64),
                ),
              ),
              const SizedBox(height: 20),
              Wrap(
                spacing: 12,
                runSpacing: 12,
                children: [
                  _StatPill(
                    icon: Icons.photo_library_outlined,
                    label: '${controller.assets.length} photos',
                  ),
                  _StatPill(
                    icon: Icons.cloud_done_outlined,
                    label: controller.microsoftStatus?.connected == true
                        ? 'Microsoft connected'
                        : 'Connect storage pending',
                  ),
                  _StatPill(
                    icon: Icons.phone_android,
                    label: controller.deviceInfo?.deviceId ?? 'Device not registered',
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _EmptyLibraryCard extends StatelessWidget {
  const _EmptyLibraryCard({
    this.onRefresh,
  });

  final Future<void> Function()? onRefresh;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.photo_library_outlined, size: 40),
            const SizedBox(height: 14),
            Text(
              'Your timeline is still empty',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            const Text(
              'Use the account tab to sign in and refresh account state. Once uploads are in place, backed-up assets will render here in a Google Photos-style grid.',
            ),
            const SizedBox(height: 18),
            OutlinedButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Refresh library'),
            ),
          ],
        ),
      ),
    );
  }
}

class _AssetTile extends StatelessWidget {
  const _AssetTile({
    required this.asset,
  });

  final AssetItem asset;

  @override
  Widget build(BuildContext context) {
    final dateLabel = asset.capturedAt == null
        ? 'Unknown date'
        : DateFormat('MMM d, yyyy • HH:mm').format(asset.capturedAt!);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Expanded(
            child: Container(
              decoration: const BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    Color(0xFFE7F2EB),
                    Color(0xFFFCE9CF),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
              ),
              alignment: Alignment.center,
              child: Icon(
                asset.mimeType.startsWith('video/') ? Icons.movie_creation_outlined : Icons.image_outlined,
                size: 42,
                color: Colors.black54,
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 12, 12, 14),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  asset.fileName,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontWeight: FontWeight.w700),
                ),
                const SizedBox(height: 4),
                Text(
                  dateLabel,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.black54),
                ),
                const SizedBox(height: 4),
                Text(
                  '${_formatBytes(asset.fileSize)} • ${asset.status}',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(color: Colors.black54),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _QueueTile extends StatelessWidget {
  const _QueueTile({
    required this.item,
  });

  final BackupQueueItem item;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    item.fileName,
                    style: const TextStyle(fontWeight: FontWeight.w700),
                  ),
                ),
                Text(item.status),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              '${_formatBytes(item.fileSize)} • ${item.message}',
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: Colors.black54),
            ),
            const SizedBox(height: 12),
            LinearProgressIndicator(value: item.progress),
          ],
        ),
      ),
    );
  }
}

class _SectionCard extends StatelessWidget {
  const _SectionCard({
    required this.title,
    required this.subtitle,
    required this.child,
    this.trailing,
  });

  final String title;
  final String subtitle;
  final Widget child;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: Theme.of(context).textTheme.titleLarge),
                      const SizedBox(height: 8),
                      Text(subtitle),
                    ],
                  ),
                ),
                if (trailing != null) ...[
                  const SizedBox(width: 16),
                  trailing!,
                ],
              ],
            ),
            const SizedBox(height: 20),
            child,
          ],
        ),
      ),
    );
  }
}

class _InlineHint extends StatelessWidget {
  const _InlineHint({
    required this.title,
    required this.body,
  });

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(title, style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 8),
        Text(body),
      ],
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SizedBox(
          width: 116,
          child: Text(
            label,
            style: const TextStyle(
              color: Colors.black54,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        Expanded(child: Text(value)),
      ],
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({
    required this.message,
  });

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFDE9E7),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: Color(0xFFB3261E)),
          const SizedBox(width: 12),
          Expanded(child: Text(message)),
        ],
      ),
    );
  }
}

class _ProgressBanner extends StatelessWidget {
  const _ProgressBanner({
    required this.message,
  });

  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFE8F3FE),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Row(
        children: [
          const SizedBox(
            width: 18,
            height: 18,
            child: CircularProgressIndicator(strokeWidth: 2.4),
          ),
          const SizedBox(width: 12),
          Expanded(child: Text(message)),
        ],
      ),
    );
  }
}

class _StatPill extends StatelessWidget {
  const _StatPill({
    required this.icon,
    required this.label,
  });

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.7),
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18),
          const SizedBox(width: 8),
          Text(label),
        ],
      ),
    );
  }
}

String _formatBytes(int bytes) {
  const units = ['B', 'KB', 'MB', 'GB'];
  double value = bytes.toDouble();
  var unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return '${value.toStringAsFixed(unitIndex == 0 ? 0 : 1)} ${units[unitIndex]}';
}
