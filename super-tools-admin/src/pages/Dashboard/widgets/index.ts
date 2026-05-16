import UnreadCountWidget from './UnreadCountWidget';
import SendTrend7dWidget from './SendTrend7dWidget';
import ChannelDistPieWidget from './ChannelDistPieWidget';
import TopTypesWidget from './TopTypesWidget';
import QueueDepthWidget from './QueueDepthWidget';

export const NOTIFICATION_WIDGETS: Record<string, React.ComponentType> = {
  notif_unread_count: UnreadCountWidget,
  notif_send_trend_7d: SendTrend7dWidget,
  notif_channel_dist_pie: ChannelDistPieWidget,
  notif_top_types: TopTypesWidget,
  notif_queue_depth: QueueDepthWidget,
};

export {
  UnreadCountWidget,
  SendTrend7dWidget,
  ChannelDistPieWidget,
  TopTypesWidget,
  QueueDepthWidget,
};
