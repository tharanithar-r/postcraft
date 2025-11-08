import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}

interface TelegramChat {
  id: number;
  type: string;
  title?: string;
  username?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: {
    chat: TelegramChat;
  };
  channel_post?: {
    chat: TelegramChat;
  };
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized. Please login first.' },
        { status: 401 }
      );
    }

    const { botToken, channelUsername } = await req.json();

    if (!botToken) {
      return NextResponse.json(
        { error: 'Bot token is required' },
        { status: 400 }
      );
    }

    // Validate bot token
    console.log('[Telegram Connect] Validating bot token...');
    const botInfoResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getMe`
    );

    if (!botInfoResponse.ok) {
      const errorData = await botInfoResponse.json();
      console.error('[Telegram Connect] Bot validation failed:', errorData);
      return NextResponse.json(
        { error: 'Invalid bot token. Please check your token and try again.' },
        { status: 400 }
      );
    }

    const botData = await botInfoResponse.json();
    const botInfo: TelegramBotInfo = botData.result;

    if (channelUsername) {
      return await connectSpecificChannel(supabase, user.id, botToken, botInfo, channelUsername);
    }

    const detectedChannels = await detectChannels(botToken);

    if (detectedChannels.length > 0) {
      return NextResponse.json({
        success: true,
        botInfo,
        channels: detectedChannels,
        needsManualEntry: false,
      });
    }

    return NextResponse.json({
      success: true,
      botInfo,
      channels: [],
      needsManualEntry: true,
      message: 'No channels detected. Please enter your channel username below.',
    });
  } catch (error) {
    console.error('[Telegram Connect] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

async function detectChannels(botToken: string): Promise<TelegramChat[]> {
  try {
    const updatesResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getUpdates?limit=100`
    );

    if (!updatesResponse.ok) {
      return [];
    }

    const updatesData = await updatesResponse.json();
    const updates: TelegramUpdate[] = updatesData.result || [];

    const channelsMap = new Map<string, TelegramChat>();

    updates.forEach(update => {
      const chat = update.channel_post?.chat || update.message?.chat;
      if (chat && (chat.type === 'channel' || chat.type === 'supergroup')) {
        const key = chat.id.toString();
        if (!channelsMap.has(key)) {
          channelsMap.set(key, chat);
        }
      }
    });

    return Array.from(channelsMap.values());
  } catch (error) {
    console.error('[Telegram] Error detecting channels:', error);
    return [];
  }
}

async function connectSpecificChannel(
  supabase: any,
  userId: string,
  botToken: string,
  botInfo: TelegramBotInfo,
  channelUsername: string
) {
  try {
    // Normalize channel identifier
    // If it's a number (channel ID), use as-is
    // If it's a username, ensure it starts with @
    let chatId: string;
    if (/^-?\d+$/.test(channelUsername)) {
      // It's a numeric ID
      chatId = channelUsername;
    } else {
      // It's a username, ensure @ prefix
      chatId = channelUsername.startsWith('@') ? channelUsername : `@${channelUsername}`;
    }

    console.log(`[Telegram Connect] Validating channel: ${chatId}`);
    const chatResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getChat?chat_id=${encodeURIComponent(chatId)}`
    );

    if (!chatResponse.ok) {
      const errorData = await chatResponse.json();
      console.error('[Telegram Connect] Channel validation failed:', errorData);
      
      if (errorData.error_code === 400) {
        return NextResponse.json(
          { error: 'Channel not found. Please check the channel username and make sure your bot is added as administrator.' },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Failed to access channel. Make sure your bot is added as administrator.' },
        { status: 400 }
      );
    }

    const chatData = await chatResponse.json();
    const chat: TelegramChat = chatData.result;

    const adminsResponse = await fetch(
      `https://api.telegram.org/bot${botToken}/getChatAdministrators?chat_id=${encodeURIComponent(chatId)}`
    );

    if (!adminsResponse.ok) {
      return NextResponse.json(
        { error: 'Bot is not an administrator of this channel. Please add your bot as administrator with "Post Messages" permission.' },
        { status: 400 }
      );
    }

    const adminsData = await adminsResponse.json();
    const administrators = adminsData.result || [];
    const botAdmin = administrators.find((admin: any) => admin.user.id === botInfo.id);

    if (!botAdmin) {
      return NextResponse.json(
        { error: 'Bot is not an administrator of this channel. Please add your bot as administrator.' },
        { status: 400 }
      );
    }

    if (!botAdmin.can_post_messages && botAdmin.status !== 'creator') {
      return NextResponse.json(
        { error: 'Bot does not have permission to post messages. Please give your bot "Post Messages" permission.' },
        { status: 400 }
      );
    }

    const { data: existing } = await supabase
      .from('social_accounts')
      .select('id')
      .eq('user_id', userId)
      .eq('platform', 'telegram')
      .eq('platform_account_id', chat.id.toString())
      .single();

    if (existing) {
      return NextResponse.json(
        { error: 'This channel is already connected.' },
        { status: 400 }
      );
    }

    
    const { error: dbError } = await supabase
      .from('social_accounts')
      .insert({
        user_id: userId,
        platform: 'telegram',
        platform_account_id: chat.id.toString(),
        account_username: chat.title || chat.username || `Channel ${chat.id}`,
        access_token: botToken,
        refresh_token: null,
        expires_at: null, // Telegram bot tokens don't expire
        platform_data: {
          botToken: botToken, // Store for reuse when adding more channels
          botId: botInfo.id.toString(),
          botUsername: botInfo.username,
          botName: botInfo.first_name,
          channelId: chat.id.toString(),
          channelUsername: chat.username,
          channelTitle: chat.title,
          channelType: chat.type,
        },
      });

    if (dbError) {
      console.error('[Telegram Connect] Database error:', dbError);
      return NextResponse.json(
        { error: 'Failed to store channel connection' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Channel connected successfully!',
      channel: {
        id: chat.id.toString(),
        title: chat.title,
        username: chat.username,
        type: chat.type,
      },
    });
  } catch (error) {
    console.error('[Telegram Connect] Error connecting channel:', error);
    return NextResponse.json(
      { error: 'Failed to connect channel' },
      { status: 500 }
    );
  }
}
