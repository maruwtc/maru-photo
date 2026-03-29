import 'package:flutter/material.dart';
import 'package:intl/intl.dart';

import '../config/app_config.dart';
import '../models/app_models.dart';
import '../state/app_controller.dart';

// ─── Root shell ───────────────────────────────────────────────────────────────

class HomeShell extends StatefulWidget {
  const HomeShell({super.key, required this.controller});
  final AppController controller;

  @override
  State<HomeShell> createState() => _HomeShellState();
}

class _HomeShellState extends State<HomeShell> {
  int _tabIndex = 0;

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;

    if (controller.isBootstrapping) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }

    final tabs = [
      _PhotosTab(controller: controller),
      _SearchTab(controller: controller),
      _LibraryTab(controller: controller),
      _AccountTab(controller: controller),
    ];

    return Scaffold(
      body: tabs[_tabIndex],
      bottomNavigationBar: Container(
        decoration: BoxDecoration(
          border: Border(top: BorderSide(color: Theme.of(context).colorScheme.outlineVariant, width: 1)),
        ),
        child: NavigationBar(
          selectedIndex: _tabIndex,
          onDestinationSelected: (i) => setState(() => _tabIndex = i),
          destinations: const [
            NavigationDestination(
              icon: Icon(Icons.photo_outlined),
              selectedIcon: Icon(Icons.photo),
              label: 'Photos',
            ),
            NavigationDestination(
              icon: Icon(Icons.search_outlined),
              selectedIcon: Icon(Icons.search),
              label: 'Search',
            ),
            NavigationDestination(
              icon: Icon(Icons.photo_library_outlined),
              selectedIcon: Icon(Icons.photo_library),
              label: 'Library',
            ),
            NavigationDestination(
              icon: Icon(Icons.account_circle_outlined),
              selectedIcon: Icon(Icons.account_circle),
              label: 'Account',
            ),
          ],
        ),
      ),
    );
  }
}

// ─── Photos tab ───────────────────────────────────────────────────────────────

class _PhotosTab extends StatelessWidget {
  const _PhotosTab({required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: _PhotoTimeline(controller: controller),
      floatingActionButton: _UploadFab(controller: controller),
    );
  }
}

class _PhotoTimeline extends StatefulWidget {
  const _PhotoTimeline({required this.controller});
  final AppController controller;

  @override
  State<_PhotoTimeline> createState() => _PhotoTimelineState();
}

class _PhotoTimelineState extends State<_PhotoTimeline> {
  List<AssetItem> _lastPrecachedAssets = const [];

  void _precacheThumbnails(List<AssetItem> assets, String accessToken) {
    if (assets == _lastPrecachedAssets || accessToken.isEmpty) return;
    _lastPrecachedAssets = assets;
    // Warm the first 40 thumbnails in Flutter's image memory cache
    for (final asset in assets.take(40)) {
      final url = '${AppConfig.apiBaseUrl}/v1/assets/${asset.id}/thumbnail?size=medium';
      precacheImage(
        NetworkImage(url, headers: {'Authorization': 'Bearer $accessToken'}),
        context,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final controller = widget.controller;
    final theme = Theme.of(context);
    final groups = _groupAssetsByDate(controller.assets);
    final groupKeys = groups.keys.toList();
    final accessToken = controller.session?.accessToken ?? '';

    _precacheThumbnails(controller.assets, accessToken);

    return RefreshIndicator(
      onRefresh: controller.refreshDashboard,
      displacement: 80,
      child: CustomScrollView(
        physics: const AlwaysScrollableScrollPhysics(),
        slivers: [
          // App bar
          SliverAppBar(
            floating: true,
            snap: true,
            title: const Text('Photos'),
            actions: [
              IconButton(
                icon: const Icon(Icons.search_outlined),
                onPressed: () {},
              ),
              Padding(
                padding: const EdgeInsets.only(right: 12),
                child: _AccountAvatar(email: controller.firebaseEmail, photoUrl: controller.firebasePhotoUrl),
              ),
            ],
          ),

          // Upload progress toast — show whenever any item is actively in-progress
          if (controller.queue.any((q) => _isActiveUploadStatus(q.status)))
            SliverToBoxAdapter(
              child: _UploadProgressToast(controller: controller),
            ),

          // Signed-out prompt
          if (controller.session == null)
            SliverFillRemaining(
              child: _SignInPrompt(controller: controller),
            )
          else if (controller.assets.isEmpty)
            SliverFillRemaining(
              child: _EmptyPhotosState(onRefresh: controller.refreshDashboard),
            )
          else ...[
            for (final key in groupKeys) ...[
              // Date header
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(16, 20, 16, 8),
                  child: Text(key, style: theme.textTheme.titleMedium),
                ),
              ),
              // Photo grid for this group
              SliverPadding(
                padding: const EdgeInsets.symmetric(horizontal: 2),
                sliver: SliverGrid(
                  delegate: SliverChildBuilderDelegate(
                    (context, index) {
                      final asset = groups[key]![index];
                      return _PhotoTile(
                        asset: asset,
                        accessToken: accessToken,
                        onTap: () => _openPhotoViewer(context, asset, controller.assets, accessToken),
                      );
                    },
                    childCount: groups[key]!.length,
                  ),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 3,
                    mainAxisSpacing: 2,
                    crossAxisSpacing: 2,
                  ),
                ),
              ),
            ],
            const SliverPadding(padding: EdgeInsets.only(bottom: 88)),
          ],
        ],
      ),
    );
  }

  void _openPhotoViewer(BuildContext context, AssetItem asset, List<AssetItem> allAssets, String accessToken) {
    Navigator.of(context).push(
      PageRouteBuilder(
        opaque: false,
        barrierColor: Colors.black,
        pageBuilder: (_, __, ___) => _PhotoViewerPage(
          asset: asset,
          allAssets: allAssets,
          accessToken: accessToken,
        ),
        transitionsBuilder: (_, animation, __, child) {
          return FadeTransition(opacity: animation, child: child);
        },
      ),
    );
  }
}

Map<String, List<AssetItem>> _groupAssetsByDate(List<AssetItem> assets) {
  final groups = <String, List<AssetItem>>{};
  for (final asset in assets) {
    final label = _dateGroupLabel(asset.capturedAt);
    groups.putIfAbsent(label, () => []).add(asset);
  }
  return groups;
}

String _dateGroupLabel(DateTime? date) {
  if (date == null) return 'Unknown date';
  final now = DateTime.now();
  final today = DateTime(now.year, now.month, now.day);
  final assetDay = DateTime(date.year, date.month, date.day);
  final diff = today.difference(assetDay).inDays;
  if (diff == 0) return 'Today';
  if (diff == 1) return 'Yesterday';
  if (date.year == now.year) return DateFormat('MMMM d').format(date);
  return DateFormat('MMMM d, yyyy').format(date);
}

// ─── Photo tile ───────────────────────────────────────────────────────────────

class _PhotoTile extends StatelessWidget {
  const _PhotoTile({
    required this.asset,
    required this.accessToken,
    required this.onTap,
  });

  final AssetItem asset;
  final String accessToken;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isVideo = asset.mimeType.startsWith('video/');
    return GestureDetector(
      onTap: onTap,
      child: Hero(
        tag: 'asset_${asset.id}',
        child: Container(
          color: Theme.of(context).colorScheme.surfaceContainerHighest,
          child: Stack(
            fit: StackFit.expand,
            children: [
              _AssetThumbnail(asset: asset, accessToken: accessToken, size: 'medium'),
              if (isVideo)
                const Positioned(
                  bottom: 6,
                  left: 6,
                  child: Icon(Icons.play_circle_filled, color: Colors.white, size: 22, shadows: [
                    Shadow(color: Colors.black45, blurRadius: 4),
                  ]),
                ),
              if (asset.status != 'ready')
                Positioned(
                  top: 6,
                  right: 6,
                  child: _StatusDot(status: asset.status),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Asset thumbnail with auth ────────────────────────────────────────────────

class _AssetThumbnail extends StatelessWidget {
  const _AssetThumbnail({
    required this.asset,
    required this.accessToken,
    this.size = 'medium',
  });

  final AssetItem asset;
  final String accessToken;
  final String size;

  @override
  Widget build(BuildContext context) {
    if (accessToken.isEmpty) {
      return _ThumbnailPlaceholder(assetId: asset.id, isVideo: asset.mimeType.startsWith('video/'));
    }

    final url = '${AppConfig.apiBaseUrl}/v1/assets/${asset.id}/thumbnail?size=$size';
    return Image.network(
      url,
      headers: {'Authorization': 'Bearer $accessToken'},
      fit: BoxFit.cover,
      gaplessPlayback: true,
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) return child;
        return _ThumbnailPlaceholder(assetId: asset.id, isVideo: asset.mimeType.startsWith('video/'));
      },
      errorBuilder: (context, error, stackTrace) {
        return _ThumbnailPlaceholder(assetId: asset.id, isVideo: asset.mimeType.startsWith('video/'));
      },
    );
  }
}

class _ThumbnailPlaceholder extends StatelessWidget {
  const _ThumbnailPlaceholder({required this.assetId, required this.isVideo});
  final String assetId;
  final bool isVideo;

  @override
  Widget build(BuildContext context) {
    // Deterministic gradient color based on asset id hash
    final hash = assetId.codeUnits.fold(0, (a, b) => a + b);
    final gradients = [
      [const Color(0xFFE3F2FD), const Color(0xFFBBDEFB)],
      [const Color(0xFFF3E5F5), const Color(0xFFE1BEE7)],
      [const Color(0xFFE8F5E9), const Color(0xFFC8E6C9)],
      [const Color(0xFFFFF8E1), const Color(0xFFFFECB3)],
      [const Color(0xFFFCE4EC), const Color(0xFFF8BBD0)],
      [const Color(0xFFE0F7FA), const Color(0xFFB2EBF2)],
    ];
    final colors = gradients[hash % gradients.length];

    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: colors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Icon(
        isVideo ? Icons.movie_creation_outlined : Icons.image_outlined,
        color: Colors.black26,
        size: 28,
      ),
    );
  }
}

class _StatusDot extends StatelessWidget {
  const _StatusDot({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final color = status == 'failed' ? Colors.red : Colors.orange;
    return Container(
      width: 8,
      height: 8,
      decoration: BoxDecoration(
        color: color,
        shape: BoxShape.circle,
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 2)],
      ),
    );
  }
}

// ─── Photo viewer ─────────────────────────────────────────────────────────────

class _PhotoViewerPage extends StatefulWidget {
  const _PhotoViewerPage({required this.asset, required this.allAssets, required this.accessToken});
  final AssetItem asset;
  final List<AssetItem> allAssets;
  final String accessToken;

  @override
  State<_PhotoViewerPage> createState() => _PhotoViewerPageState();
}

class _PhotoViewerPageState extends State<_PhotoViewerPage> {
  late final PageController _pageController;
  late int _currentIndex;
  bool _showInfo = false;
  bool _barsVisible = true;

  @override
  void initState() {
    super.initState();
    _currentIndex = widget.allAssets.indexWhere((a) => a.id == widget.asset.id);
    if (_currentIndex < 0) _currentIndex = 0;
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  AssetItem get _currentAsset => widget.allAssets[_currentIndex];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      extendBodyBehindAppBar: true,
      appBar: _barsVisible
          ? AppBar(
              backgroundColor: Colors.black54,
              foregroundColor: Colors.white,
              leading: IconButton(
                icon: const Icon(Icons.arrow_back),
                onPressed: () => Navigator.pop(context),
              ),
              actions: [
                IconButton(
                  icon: const Icon(Icons.share_outlined),
                  onPressed: () {},
                ),
                IconButton(
                  icon: const Icon(Icons.delete_outline),
                  onPressed: () {},
                ),
                IconButton(
                  icon: Icon(_showInfo ? Icons.info : Icons.info_outline),
                  onPressed: () => setState(() => _showInfo = !_showInfo),
                ),
              ],
            )
          : null,
      body: GestureDetector(
        onTap: () => setState(() => _barsVisible = !_barsVisible),
        child: Stack(
          children: [
            // Photo pager
            PageView.builder(
              controller: _pageController,
              itemCount: widget.allAssets.length,
              onPageChanged: (i) => setState(() => _currentIndex = i),
              itemBuilder: (context, index) {
                final asset = widget.allAssets[index];
                return Hero(
                  tag: 'asset_${asset.id}',
                  child: Center(
                    child: _ViewerImage(asset: asset, accessToken: widget.accessToken),
                  ),
                );
              },
            ),
            // Info panel
            if (_showInfo && _barsVisible)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: _PhotoInfoPanel(asset: _currentAsset),
              ),
          ],
        ),
      ),
    );
  }
}

class _ViewerImage extends StatelessWidget {
  const _ViewerImage({required this.asset, required this.accessToken});
  final AssetItem asset;
  final String accessToken;

  @override
  Widget build(BuildContext context) {
    if (accessToken.isEmpty) {
      return _ViewerFallback(asset: asset);
    }

    // Use 'large' size for the full-screen viewer
    final url = '${AppConfig.apiBaseUrl}/v1/assets/${asset.id}/thumbnail?size=large';
    return Image.network(
      url,
      headers: {'Authorization': 'Bearer $accessToken'},
      fit: BoxFit.contain,
      gaplessPlayback: true,
      loadingBuilder: (context, child, loadingProgress) {
        if (loadingProgress == null) return child;
        return Stack(
          alignment: Alignment.center,
          children: [
            _AssetThumbnail(asset: asset, accessToken: accessToken, size: 'medium'),
            const CircularProgressIndicator(color: Colors.white54, strokeWidth: 2),
          ],
        );
      },
      errorBuilder: (context, error, stackTrace) => _ViewerFallback(asset: asset),
    );
  }
}

class _ViewerFallback extends StatelessWidget {
  const _ViewerFallback({required this.asset});
  final AssetItem asset;

  @override
  Widget build(BuildContext context) {
    final isVideo = asset.mimeType.startsWith('video/');
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Icon(
          isVideo ? Icons.movie_creation_outlined : Icons.image_outlined,
          color: Colors.white38,
          size: 72,
        ),
        const SizedBox(height: 16),
        Text(asset.fileName,
            style: const TextStyle(color: Colors.white54, fontSize: 13),
            textAlign: TextAlign.center),
      ],
    );
  }
}

class _PhotoInfoPanel extends StatelessWidget {
  const _PhotoInfoPanel({required this.asset});
  final AssetItem asset;

  @override
  Widget build(BuildContext context) {
    final dateLabel = asset.capturedAt == null
        ? 'Unknown date'
        : DateFormat('EEE, MMM d, yyyy • h:mm a').format(asset.capturedAt!);

    return Container(
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Colors.transparent, Colors.black87],
          begin: Alignment.topCenter,
          end: Alignment.bottomCenter,
        ),
      ),
      padding: const EdgeInsets.fromLTRB(20, 40, 20, 40),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Text(asset.fileName,
              style: const TextStyle(color: Colors.white, fontWeight: FontWeight.w600, fontSize: 16)),
          const SizedBox(height: 6),
          Text(dateLabel, style: const TextStyle(color: Colors.white70, fontSize: 13)),
          const SizedBox(height: 4),
          Text(
            '${_formatBytes(asset.fileSize)} • ${asset.mimeType}',
            style: const TextStyle(color: Colors.white70, fontSize: 13),
          ),
        ],
      ),
    );
  }
}

// ─── Upload FAB + progress toast ──────────────────────────────────────────────

class _UploadFab extends StatelessWidget {
  const _UploadFab({required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final isUploading = controller.queue.any((q) => q.status == 'uploading');
    return FloatingActionButton.extended(
      onPressed: () => _showUploadSheet(context),
      icon: isUploading
          ? const SizedBox(
              width: 18, height: 18,
              child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white),
            )
          : const Icon(Icons.cloud_upload_outlined),
      label: Text(isUploading ? 'Backing up…' : 'Back up'),
      backgroundColor: Theme.of(context).colorScheme.primary,
      foregroundColor: Colors.white,
    );
  }

  void _showUploadSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      builder: (_) => _UploadSheet(controller: controller),
    );
  }
}

bool _isActiveUploadStatus(String status) =>
    const {'queued', 'hashing', 'starting', 'uploading', 'finalizing'}.contains(status);

class _UploadProgressToast extends StatelessWidget {
  const _UploadProgressToast({required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final queue = controller.queue;
    final uploadingItem = queue.where((q) => q.status == 'uploading').firstOrNull;
    final activeItem = queue.where((q) => _isActiveUploadStatus(q.status)).firstOrNull;
    final doneCount = queue.where((q) => q.status == 'done').length;
    final total = queue.length;
    final progress = total > 0 ? doneCount / total : 0.0;

    final String label;
    if (uploadingItem != null) {
      label = 'Backing up ${uploadingItem.fileName}';
    } else if (activeItem?.status == 'hashing') {
      label = 'Analysing ${activeItem!.fileName}…';
    } else if (activeItem?.status == 'finalizing') {
      label = 'Finishing ${activeItem!.fileName}…';
    } else if (activeItem != null) {
      label = 'Starting upload…';
    } else {
      label = 'Preparing backup…';
    }

    final cs = Theme.of(context).colorScheme;
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.fromLTRB(16, 12, 16, 14),
      decoration: BoxDecoration(
        color: cs.inverseSurface,
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [BoxShadow(color: Colors.black26, blurRadius: 8, offset: Offset(0, 2))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              SizedBox(width: 16, height: 16,
                  child: CircularProgressIndicator(strokeWidth: 2, color: cs.onInverseSurface)),
              const SizedBox(width: 12),
              Expanded(
                child: Text(label,
                    style: TextStyle(color: cs.onInverseSurface, fontSize: 13),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
              ),
              Text('$doneCount / $total',
                  style: TextStyle(color: cs.onInverseSurface.withValues(alpha: 0.7), fontSize: 12)),
            ],
          ),
          const SizedBox(height: 8),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              backgroundColor: cs.onInverseSurface.withValues(alpha: 0.24),
              color: cs.onInverseSurface,
              minHeight: 3,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Upload bottom sheet ──────────────────────────────────────────────────────

class _UploadSheet extends StatelessWidget {
  const _UploadSheet({required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final queue = controller.queue;

    return DraggableScrollableSheet(
      initialChildSize: 0.6,
      maxChildSize: 0.9,
      minChildSize: 0.4,
      expand: false,
      builder: (_, scrollController) => Column(
        children: [
          // Handle
          Center(
            child: Container(
              margin: const EdgeInsets.only(top: 12, bottom: 8),
              width: 36,
              height: 4,
              decoration: BoxDecoration(
                color: const Color(0xFFDADCE0),
                borderRadius: BorderRadius.circular(2),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
            child: Row(
              children: [
                Expanded(
                  child: Text('Backup queue', style: theme.textTheme.titleLarge),
                ),
                if (queue.isNotEmpty)
                  TextButton.icon(
                    icon: const Icon(Icons.cloud_upload_outlined, size: 18),
                    label: const Text('Upload all'),
                    onPressed: () {
                      Navigator.pop(context);
                      controller.uploadPendingQueue();
                    },
                  ),
                IconButton(
                  icon: const Icon(Icons.add_photo_alternate_outlined),
                  tooltip: 'Pick files',
                  onPressed: () {
                    Navigator.pop(context);
                    controller.pickFilesForUpload();
                  },
                ),
              ],
            ),
          ),
          const Divider(height: 1),
          Expanded(
            child: queue.isEmpty
                ? _EmptyQueueState(
                    onPick: () {
                      Navigator.pop(context);
                      controller.pickFilesForUpload();
                    },
                  )
                : ListView.separated(
                    controller: scrollController,
                    padding: const EdgeInsets.symmetric(vertical: 8),
                    itemCount: queue.length,
                    separatorBuilder: (_, __) => const Divider(height: 1, indent: 16),
                    itemBuilder: (_, i) => _QueueListTile(item: queue[i]),
                  ),
          ),
        ],
      ),
    );
  }
}

class _EmptyQueueState extends StatelessWidget {
  const _EmptyQueueState({required this.onPick});
  final VoidCallback onPick;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_upload_outlined, size: 56, color: Color(0xFFDADCE0)),
          const SizedBox(height: 16),
          Text('No files in queue', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 8),
          const Text('Pick files to start backing them up', style: TextStyle(color: Color(0xFF5F6368))),
          const SizedBox(height: 24),
          FilledButton.icon(
            onPressed: onPick,
            icon: const Icon(Icons.add_photo_alternate_outlined),
            label: const Text('Pick files'),
          ),
        ],
      ),
    );
  }
}

class _QueueListTile extends StatelessWidget {
  const _QueueListTile({required this.item});
  final BackupQueueItem item;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final Color statusColor;
    final IconData statusIcon;

    switch (item.status) {
      case 'done':
        statusColor = const Color(0xFF34A853);
        statusIcon = Icons.check_circle_outline;
      case 'failed':
        statusColor = const Color(0xFFEA4335);
        statusIcon = Icons.error_outline;
      case 'uploading':
        statusColor = const Color(0xFF1A73E8);
        statusIcon = Icons.cloud_upload_outlined;
      default:
        statusColor = const Color(0xFF9AA0A6);
        statusIcon = Icons.schedule_outlined;
    }

    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: cs.surfaceContainerHighest,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              item.fileName.contains('.mp4') || item.fileName.contains('.mov')
                  ? Icons.movie_outlined
                  : Icons.image_outlined,
              color: cs.onSurfaceVariant,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(item.fileName,
                    style: theme.textTheme.bodyMedium?.copyWith(
                        color: cs.onSurface, fontWeight: FontWeight.w500),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                const SizedBox(height: 3),
                Text('${_formatBytes(item.fileSize)} • ${item.message}',
                    style: theme.textTheme.bodySmall,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
                if (item.status == 'uploading') ...[
                  const SizedBox(height: 6),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(4),
                    child: LinearProgressIndicator(
                      value: item.progress,
                      minHeight: 3,
                      backgroundColor: cs.outlineVariant,
                    ),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(width: 12),
          Icon(statusIcon, color: statusColor, size: 20),
        ],
      ),
    );
  }
}

// ─── Search tab ───────────────────────────────────────────────────────────────

class _SearchTab extends StatelessWidget {
  const _SearchTab({required this.controller});
  final AppController controller;

  static const _categories = [
    (icon: Icons.people_outline, label: 'People & pets'),
    (icon: Icons.place_outlined, label: 'Places'),
    (icon: Icons.category_outlined, label: 'Things'),
    (icon: Icons.movie_creation_outlined, label: 'Videos'),
    (icon: Icons.screenshot_monitor_outlined, label: 'Screenshots'),
    (icon: Icons.document_scanner_outlined, label: 'Documents'),
    (icon: Icons.celebration_outlined, label: 'Selfies'),
    (icon: Icons.landscape_outlined, label: 'Landscapes'),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return CustomScrollView(
      slivers: [
        const SliverAppBar(
          pinned: true,
          title: Text('Search'),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
            child: TextField(
              readOnly: true,
              decoration: const InputDecoration(
                hintText: 'Search your photos',
                prefixIcon: Icon(Icons.search, color: Color(0xFF9AA0A6)),
                suffixIcon: Icon(Icons.mic_outlined, color: Color(0xFF9AA0A6)),
              ),
              onTap: () {},
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 24, 16, 12),
            child: Text('Browse by category', style: theme.textTheme.titleMedium),
          ),
        ),
        SliverPadding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          sliver: SliverGrid(
            delegate: SliverChildBuilderDelegate(
              (context, index) {
                final cat = _categories[index];
                return _CategoryCard(icon: cat.icon, label: cat.label);
              },
              childCount: _categories.length,
            ),
            gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
              crossAxisCount: 2,
              mainAxisSpacing: 12,
              crossAxisSpacing: 12,
              childAspectRatio: 2.6,
            ),
          ),
        ),
        const SliverPadding(padding: EdgeInsets.only(bottom: 88)),
      ],
    );
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({required this.icon, required this.label});
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFF1F3F4),
      borderRadius: BorderRadius.circular(12),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: () {},
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          child: Row(
            children: [
              Icon(icon, size: 22, color: const Color(0xFF5F6368)),
              const SizedBox(width: 12),
              Expanded(
                child: Text(label,
                    style: const TextStyle(
                        fontWeight: FontWeight.w500, fontSize: 13, color: Color(0xFF202124)),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// ─── Library tab ──────────────────────────────────────────────────────────────

class _LibraryTab extends StatelessWidget {
  const _LibraryTab({required this.controller});
  final AppController controller;

  static const _sections = [
    (icon: Icons.favorite_outline, label: 'Favourites', color: Color(0xFFEA4335)),
    (icon: Icons.lock_outline, label: 'Locked folder', color: Color(0xFF5F6368)),
    (icon: Icons.archive_outlined, label: 'Archive', color: Color(0xFF9AA0A6)),
    (icon: Icons.delete_outline, label: 'Bin', color: Color(0xFF9AA0A6)),
    (icon: Icons.cloud_outlined, label: 'Microsoft storage', color: Color(0xFF1A73E8)),
  ];

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return CustomScrollView(
      slivers: [
        const SliverAppBar(
          pinned: true,
          title: Text('Library'),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Utilities', style: theme.textTheme.titleMedium),
                const SizedBox(height: 12),
                ...(_sections.map((s) => _LibraryListTile(
                      icon: s.icon,
                      label: s.label,
                      iconColor: s.color,
                    ))),
                const SizedBox(height: 24),
                Text('Albums', style: theme.textTheme.titleMedium),
                const SizedBox(height: 8),
              ],
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: controller.assets.isEmpty
              ? const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16, vertical: 32),
                  child: Center(
                    child: Text('Albums will appear here once photos are backed up.',
                        style: TextStyle(color: Color(0xFF9AA0A6)),
                        textAlign: TextAlign.center),
                  ),
                )
              : Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: _AlbumGrid(assets: controller.assets),
                ),
        ),
        const SliverPadding(padding: EdgeInsets.only(bottom: 88)),
      ],
    );
  }
}

class _LibraryListTile extends StatelessWidget {
  const _LibraryListTile({required this.icon, required this.label, required this.iconColor});
  final IconData icon;
  final String label;
  final Color iconColor;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      dense: true,
      contentPadding: EdgeInsets.zero,
      leading: Container(
        width: 36,
        height: 36,
        decoration: BoxDecoration(
          color: iconColor.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(icon, size: 20, color: iconColor),
      ),
      title: Text(label, style: const TextStyle(fontWeight: FontWeight.w500)),
      trailing: const Icon(Icons.chevron_right, color: Color(0xFFDADCE0)),
      onTap: () {},
    );
  }
}

class _AlbumGrid extends StatelessWidget {
  const _AlbumGrid({required this.assets});
  final List<AssetItem> assets;

  @override
  Widget build(BuildContext context) {
    // Auto-generate a "Camera" album from all assets
    final albums = [
      ('Camera', assets.length),
      ('Screenshots', 0),
      ('Downloads', 0),
    ];

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: albums.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        mainAxisSpacing: 12,
        crossAxisSpacing: 12,
        childAspectRatio: 0.9,
      ),
      itemBuilder: (_, i) => _AlbumCard(name: albums[i].$1, count: albums[i].$2),
    );
  }
}

class _AlbumCard extends StatelessWidget {
  const _AlbumCard({required this.name, required this.count});
  final String name;
  final int count;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Expanded(
          child: ClipRRect(
            borderRadius: BorderRadius.circular(12),
            child: Container(
              color: const Color(0xFFF1F3F4),
              child: const Center(
                child: Icon(Icons.photo_library_outlined, size: 40, color: Color(0xFFDADCE0)),
              ),
            ),
          ),
        ),
        const SizedBox(height: 6),
        Text(name, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
        Text('$count items', style: const TextStyle(fontSize: 12, color: Color(0xFF5F6368))),
      ],
    );
  }
}

// ─── Account tab ──────────────────────────────────────────────────────────────

class _AccountTab extends StatelessWidget {
  const _AccountTab({required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final ms = controller.microsoftStatus;
    final totalQueue = controller.queue.length;
    final doneQueue = controller.queue.where((q) => q.status == 'done').length;

    return CustomScrollView(
      slivers: [
        const SliverAppBar(
          pinned: true,
          title: Text('Account'),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: [
                // Profile card
                _ProfileCard(controller: controller),
                const SizedBox(height: 16),

                // Appearance card
                _AppearanceCard(controller: controller),
                const SizedBox(height: 16),

                // Auto-backup card (always shown so user can enable before signing in message is clear)
                _AutoBackupCard(controller: controller),
                const SizedBox(height: 16),

                // Backup status
                if (controller.session != null) ...[
                  _InfoCard(
                    title: 'Backup',
                    children: [
                      _InfoRow(
                        icon: Icons.photo_library_outlined,
                        label: 'Photos backed up',
                        value: '${controller.assets.length}',
                      ),
                      if (totalQueue > 0)
                        _InfoRow(
                          icon: Icons.cloud_upload_outlined,
                          label: 'Upload queue',
                          value: '$doneQueue / $totalQueue done',
                        ),
                      _InfoRow(
                        icon: Icons.cloud_outlined,
                        label: 'Storage',
                        value: ms?.connected == true
                            ? '${ms!.displayName ?? 'Microsoft'} (${ms.driveType ?? 'business'})'
                            : 'Not connected',
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Storage connection card
                  _InfoCard(
                    title: 'Microsoft storage',
                    trailing: OutlinedButton(
                      onPressed: controller.refreshDashboard,
                      child: const Text('Refresh'),
                    ),
                    children: [
                      _InfoRow(
                        icon: ms?.connected == true
                            ? Icons.check_circle_outline
                            : Icons.link_off_outlined,
                        label: 'Status',
                        value: ms?.connected == true ? 'Connected' : 'Not connected',
                        valueColor: ms?.connected == true
                            ? const Color(0xFF34A853)
                            : const Color(0xFFEA4335),
                      ),
                      if (ms?.email != null)
                        _InfoRow(
                          icon: Icons.email_outlined,
                          label: 'Account',
                          value: ms!.email!,
                        ),
                      if (ms?.driveType != null)
                        _InfoRow(
                          icon: Icons.storage_outlined,
                          label: 'Drive type',
                          value: ms!.driveType!,
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Device card
                  _InfoCard(
                    title: 'Device',
                    children: [
                      _InfoRow(
                        icon: Icons.phone_android_outlined,
                        label: 'Device ID',
                        value: controller.deviceInfo?.deviceId ?? 'Not registered',
                      ),
                      _InfoRow(
                        icon: Icons.devices_outlined,
                        label: 'Platform',
                        value: controller.deviceInfo?.platform ?? 'Unknown',
                      ),
                    ],
                  ),
                ],

                // Error banner
                if (controller.errorMessage != null) ...[
                  const SizedBox(height: 16),
                  _ErrorBanner(message: controller.errorMessage!),
                ],

                const SizedBox(height: 88),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

// ─── Auto-backup card ─────────────────────────────────────────────────────────

// ─── Appearance card ──────────────────────────────────────────────────────────

class _AppearanceCard extends StatelessWidget {
  const _AppearanceCard({required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return _InfoCard(
      title: 'Appearance',
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
          child: SegmentedButton<ThemeMode>(
            expandedInsets: EdgeInsets.zero,
            segments: const [
              ButtonSegment(
                value: ThemeMode.light,
                label: Text('Light'),
                icon: Icon(Icons.light_mode_outlined),
              ),
              ButtonSegment(
                value: ThemeMode.system,
                label: Text('System'),
                icon: Icon(Icons.brightness_auto_outlined),
              ),
              ButtonSegment(
                value: ThemeMode.dark,
                label: Text('Dark'),
                icon: Icon(Icons.dark_mode_outlined),
              ),
            ],
            selected: {controller.themeMode},
            onSelectionChanged: (s) => controller.setThemeMode(s.first),
          ),
        ),
      ],
    );
  }
}

class _AutoBackupCard extends StatelessWidget {
  const _AutoBackupCard({required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final enabled = controller.autoBackupEnabled;
    final lastTime = controller.lastAutoBackupTime;

    String subtitle;
    if (!enabled) {
      subtitle = 'Automatically back up new photos and videos from your device every hour.';
    } else if (lastTime == null) {
      subtitle = 'Enabled — first backup will run shortly.';
    } else {
      final diff = DateTime.now().difference(lastTime);
      final label = diff.inMinutes < 60
          ? '${diff.inMinutes}m ago'
          : diff.inHours < 24
              ? '${diff.inHours}h ago'
              : DateFormat('MMM d').format(lastTime);
      subtitle = 'Last backup: $label';
    }

    final cs = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: enabled ? cs.primaryContainer : cs.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: enabled ? cs.primary : cs.outlineVariant,
        ),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 8, 14),
            child: Row(
              children: [
                Container(
                  width: 40,
                  height: 40,
                  decoration: BoxDecoration(
                    color: enabled ? cs.primary : cs.surfaceContainerHighest,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    enabled ? Icons.cloud_done_outlined : Icons.cloud_upload_outlined,
                    color: enabled ? cs.onPrimary : cs.onSurfaceVariant,
                    size: 20,
                  ),
                ),
                const SizedBox(width: 14),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Auto Backup',
                          style: theme.textTheme.titleMedium?.copyWith(
                            color: enabled ? cs.primary : null,
                          )),
                      const SizedBox(height: 2),
                      Text(subtitle,
                          style: theme.textTheme.bodySmall,
                          maxLines: 2),
                    ],
                  ),
                ),
                Switch(
                  value: enabled,
                  onChanged: (_) => controller.toggleAutoBackup(),
                ),
              ],
            ),
          ),
          if (enabled) ...[
            Divider(height: 1, color: cs.outlineVariant),
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              child: Row(
                children: [
                  Icon(Icons.wifi_outlined, size: 16, color: cs.onSurfaceVariant),
                  const SizedBox(width: 8),
                  Text(
                    'Runs hourly on WiFi or mobile data',
                    style: theme.textTheme.bodySmall,
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ProfileCard extends StatelessWidget {
  const _ProfileCard({required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final isSignedIn = controller.session != null;

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFF8F9FA),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFE8EAED)),
      ),
      child: Row(
        children: [
          _AccountAvatar(email: controller.firebaseEmail, photoUrl: controller.firebasePhotoUrl, size: 56),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  controller.firebaseEmail ?? 'Not signed in',
                  style: theme.textTheme.titleMedium,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Text(
                  isSignedIn ? 'Google account' : 'Sign in to back up photos',
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ),
          ),
          FilledButton(
            onPressed: controller.isSigningIn ? null : controller.signInFlow,
            style: FilledButton.styleFrom(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              minimumSize: Size.zero,
              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
            ),
            child: controller.isSigningIn
                ? const SizedBox(width: 16, height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                : Text(isSignedIn ? 'Manage' : 'Sign in'),
          ),
        ],
      ),
    );
  }
}

class _InfoCard extends StatelessWidget {
  const _InfoCard({
    required this.title,
    required this.children,
    this.trailing,
  });

  final String title;
  final List<Widget> children;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Container(
      decoration: BoxDecoration(
        color: cs.surfaceContainerLowest,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: cs.outlineVariant),
      ),
      child: Column(
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 14, 16, 10),
            child: Row(
              children: [
                Expanded(
                  child: Text(title,
                      style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15,
                          color: cs.onSurface)),
                ),
                if (trailing != null) trailing!,
              ],
            ),
          ),
          Divider(height: 1, color: cs.outlineVariant),
          ...children,
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({
    required this.icon,
    required this.label,
    required this.value,
    this.valueColor,
  });

  final IconData icon;
  final String label;
  final String value;
  final Color? valueColor;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          Icon(icon, size: 18, color: cs.onSurfaceVariant),
          const SizedBox(width: 12),
          SizedBox(
            width: 120,
            child: Text(label,
                style: TextStyle(color: cs.onSurfaceVariant, fontSize: 13),
                maxLines: 1),
          ),
          Expanded(
            child: Text(
              value,
              style: TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                  color: valueColor ?? cs.onSurface),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
          ),
        ],
      ),
    );
  }
}

// ─── Shared widgets ───────────────────────────────────────────────────────────

class _AccountAvatar extends StatelessWidget {
  const _AccountAvatar({this.email, this.photoUrl, this.size = 32});
  final String? email;
  final String? photoUrl;
  final double size;

  @override
  Widget build(BuildContext context) {
    final cs = Theme.of(context).colorScheme;
    final initial = email?.isNotEmpty == true ? email![0].toUpperCase() : '?';

    Widget child;
    if (photoUrl != null) {
      child = ClipOval(
        child: Image.network(
          photoUrl!,
          width: size,
          height: size,
          fit: BoxFit.cover,
          errorBuilder: (_, __, ___) => _InitialAvatar(initial: initial, size: size, cs: cs),
        ),
      );
    } else {
      child = _InitialAvatar(initial: initial, size: size, cs: cs);
    }

    return SizedBox(width: size, height: size, child: child);
  }
}

class _InitialAvatar extends StatelessWidget {
  const _InitialAvatar({required this.initial, required this.size, required this.cs});
  final String initial;
  final double size;
  final ColorScheme cs;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(color: cs.primary, shape: BoxShape.circle),
      child: Center(
        child: Text(
          initial,
          style: TextStyle(
            color: cs.onPrimary,
            fontWeight: FontWeight.w700,
            fontSize: size * 0.45,
          ),
        ),
      ),
    );
  }
}

class _SignInPrompt extends StatelessWidget {
  const _SignInPrompt({required this.controller});
  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.photo_camera_outlined,
                size: 72, color: Theme.of(context).colorScheme.primary),
            const SizedBox(height: 24),
            Text('Your photos, safely backed up',
                style: Theme.of(context).textTheme.headlineMedium,
                textAlign: TextAlign.center),
            const SizedBox(height: 12),
            const Text(
              'Sign in with Google to see your backed-up photos and start protecting memories.',
              textAlign: TextAlign.center,
              style: TextStyle(color: Color(0xFF5F6368), height: 1.5),
            ),
            const SizedBox(height: 32),
            FilledButton.icon(
              onPressed: controller.isSigningIn ? null : controller.signInFlow,
              icon: controller.isSigningIn
                  ? const SizedBox(width: 18, height: 18,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Icon(Icons.login),
              label: Text(controller.isSigningIn
                  ? (controller.signInStatusMessage ?? 'Signing in…')
                  : 'Sign in with Google'),
            ),
          ],
        ),
      ),
    );
  }
}

class _EmptyPhotosState extends StatelessWidget {
  const _EmptyPhotosState({required this.onRefresh});
  final Future<void> Function() onRefresh;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.photo_library_outlined, size: 72, color: Color(0xFFDADCE0)),
            const SizedBox(height: 20),
            Text('No photos yet', style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            const Text('Back up photos using the button below, or refresh to reload.',
                textAlign: TextAlign.center,
                style: TextStyle(color: Color(0xFF5F6368))),
            const SizedBox(height: 24),
            OutlinedButton.icon(
              onPressed: onRefresh,
              icon: const Icon(Icons.refresh),
              label: const Text('Refresh'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ErrorBanner extends StatelessWidget {
  const _ErrorBanner({required this.message});
  final String message;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: const Color(0xFFFCE8E6),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: const Color(0xFFF28B82)),
      ),
      child: Row(
        children: [
          const Icon(Icons.error_outline, color: Color(0xFFEA4335), size: 20),
          const SizedBox(width: 12),
          Expanded(
            child: Text(message, style: const TextStyle(color: Color(0xFF202124), fontSize: 13)),
          ),
        ],
      ),
    );
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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
