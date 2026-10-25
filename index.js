const {
    Client,
    GatewayIntentBits,
    SlashCommandBuilder,
    REST,
    Routes,
    PermissionFlagsBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder
} = require('discord.js');

const fs = require('fs');
const path = './economy.json';
const configPath = './config.json';

// تحميل ملف الاقتصاد
let economy = {};
if (fs.existsSync(path)) {
    try { economy = JSON.parse(fs.readFileSync(path, 'utf8')); } catch (e) { economy = {}; }
} else {
    fs.writeFileSync(path, JSON.stringify({}));
}

function saveEconomy() {
    fs.writeFileSync(path, JSON.stringify(economy, null, 4));
}

// تحميل ملف الإعدادات
let serverConfig = {};
if (fs.existsSync(configPath)) {
    try { serverConfig = JSON.parse(fs.readFileSync(configPath, 'utf8')); } catch (e) { serverConfig = {}; }
} else {
    fs.writeFileSync(configPath, JSON.stringify({}));
}

function saveConfig() {
    fs.writeFileSync(configPath, JSON.stringify(serverConfig, null, 4));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ]
});

// تخزين الفعاليات النشطة للحذف التدريجي
const activeEliminationEvents = new Map();

client.once('ready', async () => {
    console.log(`البوت جاهز الآن باسم [ تم التشغيل ]`);

    const commands = [
        new SlashCommandBuilder()
            .setName('تكت')
            .setDescription('إرسال وتخصيص لوحة التكتات بالكامل')
            .addChannelOption(option => option.setName('الروم').setDescription('اختر الروم').setRequired(true))
            .addStringOption(option => option.setName('العنوان').setDescription('عنوان رسالة التكت').setRequired(false))
            .addStringOption(option => option.setName('الوصف').setDescription('وصف رسالة التكت').setRequired(false))
            .addStringOption(option => 
                option.setName('اللون')
                    .setDescription('اختر لون الإيمبيد بالأسماء العربية')
                    .setRequired(false)
                    .addChoices(
                        { name: '💜 بنفسجي', value: 'purple' },
                        { name: '🩷 وردي', value: 'pink' },
                        { name: '❤️ أحمر', value: 'red' },
                        { name: '💙 أزرق', value: 'blue' },
                        { name: '💚 أخضر', value: 'green' },
                        { name: '💛 أصفر / ذهبي', value: 'gold' },
                        { name: '🖤 أسود داكن', value: 'dark' },
                        { name: '🤍 أبيض', value: 'white' }
                    )
            )
            .addStringOption(option => option.setName('الصورة').setDescription('رابط صورة/شعار').setRequired(false)),
        new SlashCommandBuilder().setName('مسح').setDescription('مسح عدد محدد من الرسائل').addIntegerOption(option => option.setName('العدد').setDescription('من 1 إلى 100').setRequired(true)),
        new SlashCommandBuilder().setName('balance').setDescription('رصيدك أو رصيد عضو آخر').addUserOption(option => option.setName('user').setDescription('العضو المراد عرض رصيده').setRequired(false)),
        new SlashCommandBuilder().setName('daily').setDescription('استلم راتبك اليومي (300 عملة كل 24 ساعة)'),
        new SlashCommandBuilder().setName('shop').setDescription('عرض الرتب والمميزات'),
        new SlashCommandBuilder().setName('buy').setDescription('شراء منتج من المتجر').addStringOption(option => option.setName('item').setDescription('المنتج المراد شراؤه').setRequired(true).addChoices({ name: 'VIP', value: 'vip' })),
        new SlashCommandBuilder().setName('give').setDescription('([للإدارة]) إعطاء عملات لعضو معين').addUserOption(option => option.setName('user').setDescription('العضو').setRequired(true)).addIntegerOption(option => option.setName('amount').setDescription('المبلغ').setRequired(true)),
        new SlashCommandBuilder().setName('setwelcome').setDescription('([للإدارة]) تحديد روم الترحيب').addChannelOption(option => option.setName('الروم').setDescription('روم الترحيب').setRequired(true)),
        
        // قائمة الألعاب السريعة
        new SlashCommandBuilder()
            .setName('فعاليات')
            .setDescription('إرسال لوحة الألعاب والفعاليات التنافسية في الروم')
            .addChannelOption(option => option.setName('الروم').setDescription('روم إرسال اللوحة').setRequired(true)),
            
        // أمر روليت المراكز والحذف التدريجي الجديد 🔥
        new SlashCommandBuilder()
            .setName('روليت-المراكز')
            .setDescription('([للإدارة]) إطلاق لعبة روليت الحذف التدريجي (المقاعد تطير لين يبقى الفائز)')
            .addChannelOption(option => option.setName('الروم').setDescription('روم الفعالية').setRequired(true))
            .addIntegerOption(option => option.setName('المقاعد').setDescription('عدد الأماكن المتاحة (مثلاً 5)').setRequired(true))
            .addIntegerOption(option => option.setName('الجائزة').setDescription('عدد العملات الجائزة للفائز الأخير').setRequired(true)),

        new SlashCommandBuilder().setName('event').setDescription('([للإدارة]) إطلاق فعالية سريعة').addStringOption(option => option.setName('الجائزة').setDescription('وصف الجائزة').setRequired(true))
    ].map(command => command.toJSON());

    const rest = new REST({ version: '10' }).setToken(client.token);

    try {
        console.log('...جاري تحديث وتسجيل جميع الأوامر');
        await rest.put(
            Routes.applicationCommands(client.user.id),
            { body: commands },
        );
        console.log('!تم تسجيل جميع الأوامر بنجاح');
    } catch (error) {
        console.error(error);
    }
});

// --- نظام الترحيب لسيرفر فيم ---
client.on('guildMemberAdd', async member => {
    const guildId = member.guild.id;
    if (!serverConfig[guildId] || !serverConfig[guildId].welcomeChannel) return;

    const channelId = serverConfig[guildId].welcomeChannel;
    const channel = member.guild.channels.cache.get(channelId);
    if (!channel) return;

    const welcomeEmbed = new EmbedBuilder()
        .setColor('#9b59b6')
        .setTitle('🔥 أهلاً بك في سيرفر فيم!')
        .setDescription(`منور صدقني بتستمع بسيرفر فيم (ممنوع سب الاهل ) وانتظر الحصري`)
        .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
        .setTimestamp();

    channel.send({ content: `يا هلا فيك ${member}! ❤️`, embeds: [welcomeEmbed] });
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isStringSelectMenu() && !interaction.isButton()) return;

    const { commandName, user, options, guild, member } = interaction;

    if (interaction.isChatInputCommand()) {
        if (['balance', 'daily', 'shop', 'buy', 'give'].includes(commandName)) {
            if (!economy[user.id]) {
                economy[user.id] = { coins: 100, inventory: [], lastDaily: 0 };
                saveEconomy();
            }
        }

        if (commandName === 'balance') {
            const target = options.getUser('user') || user;
            if (!economy[target.id]) {
                economy[target.id] = { coins: 100, inventory: [], lastDaily: 0 };
                saveEconomy();
            }
            const bal = economy[target.id].coins;
            await interaction.reply({ content: `💰 رصيد العضو ${target.username} هو: **${bal}** عملة.`, ephemeral: true });
        }
        else if (commandName === 'daily') {
            const cooldownTime = 24 * 60 * 60 * 1000;
            const now = Date.now();
            if (!economy[user.id].lastDaily) economy[user.id].lastDaily = 0;

            if (now - economy[user.id].lastDaily < cooldownTime) {
                const remainingTime = Math.ceil((cooldownTime - (now - economy[user.id].lastDaily)) / (1000 * 60 * 60));
                return interaction.reply({ content: `⏳ لقد استلمت راتبك اليومي مسبقاً! باقي **${remainingTime}** ساعة.`, ephemeral: true });
            }

            economy[user.id].coins += 300;
            economy[user.id].lastDaily = now;
            saveEconomy();
            await interaction.reply({ content: `🎁 تم إضافة **300** عملة لرصيدك بنجاح!`, ephemeral: true });
        }
        else if (commandName === 'give') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator) && !member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                return interaction.reply({ content: `❌ عذراً، هذا الأمر مخصص للإدارة فقط!`, ephemeral: true });
            }

            const targetUser = options.getUser('user');
            const amount = options.getInteger('amount');
            if (amount <= 0) return interaction.reply({ content: `❌ يجب أن يكون المبلغ أكبر من صفر.`, ephemeral: true });

            if (!economy[targetUser.id]) economy[targetUser.id] = { coins: 100, inventory: [], lastDaily: 0 };
            economy[targetUser.id].coins += amount;
            saveEconomy();

            await interaction.reply({ content: `✅ تم إعطاء **${amount}** عملة للعضو ${targetUser} بنجاح!`, ephemeral: true });
        }
        else if (commandName === 'shop') {
            const shopEmbed = new EmbedBuilder()
                .setColor('#FFD700')
                .setTitle('🛒 متجر البوت')
                .setDescription('اجمع عملاتك واشتر المميزات الآن!')
                .addFields({ name: '👑 رتبة VIP', value: 'السعر: 2000 عملة\nالأمر: `/buy item:vip`' });
            await interaction.reply({ embeds: [shopEmbed], ephemeral: true });
        }
        else if (commandName === 'buy') {
            const item = options.getString('item');
            if (item === 'vip') {
                if (economy[user.id].coins >= 2000) {
                    economy[user.id].coins -= 2000;
                    saveEconomy();
                    await interaction.reply({ content: `🎉 بطل! تم خصم 2000 عملة وإعطائك رتبة VIP بنجاح!`, ephemeral: true });
                } else {
                    await interaction.reply({ content: `❌ رصيدك غير كافي! تحتاج إلى 2000 عملة لشراء VIP.`, ephemeral: true });
                }
            }
        }
        else if (commandName === 'setwelcome') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: `❌ هذا الأمر للإدارة فقط!`, ephemeral: true });
            }
            const targetChannel = options.getChannel('الروم');
            if (!serverConfig[guild.id]) serverConfig[guild.id] = {};
            serverConfig[guild.id].welcomeChannel = targetChannel.id;
            saveConfig();

            await interaction.reply({ content: `✅ تم تعيين ${targetChannel} كـ روم للترحيب بالأعضاء الجدد بنجاح!`, ephemeral: true });
        }
        
        // --- أمر روليت المراكز والحذف التدريجي ---
        else if (commandName === 'روليت-المراكز') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: `❌ هذا الأمر للإدارة فقط!`, ephemeral: true });
            }

            const targetChannel = options.getChannel('روم');
            const maxSeats = options.getInteger('المقاعد');
            const prize = options.getInteger('الجائزة');

            const embed = new EmbedBuilder()
                .setColor('#ffaa00')
                .setTitle('🎯 روليت المراكز (الكراسي التنافسية)')
                .setDescription(`تم فتح باب الحجز!\n• **عدد المقاعد المتاحة:** ${maxSeats}\n• **الجائزة للفائز الأخير:** ${prize} عملة\n\nاضغط على الزر بالأسفل لحجز مقعدك قبل ما يكتمل العدد! 🪑`)
                .setTimestamp();

            const joinBtn = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('join_elimination_game').setLabel('احجز مقعدك 🪑').setStyle(ButtonStyle.Success)
            );

            const msg = await targetChannel.send({ embeds: [embed], components: [joinBtn] });

            // حفظ بيانات الفعالية
            activeEliminationEvents.set(msg.id, {
                maxSeats: maxSeats,
                prize: prize,
                players: [],
                status: 'open'
            });

            await interaction.reply({ content: `✅ تم إطلاق فعالية روليت المراكز في ${targetChannel} بنجاح!`, ephemeral: true });
        }

        else if (commandName === 'فعاليات') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: `❌ هذا الأمر للإدارة فقط!`, ephemeral: true });
            }
            const targetChannel = options.getChannel('الروم');

            const menuEmbed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle('🎮 قسم الألعاب والفعاليات في سيرفر فيم')
                .setDescription('اختر اللعبة التنافسية أو الفعالية التي تبيها من القائمة بالأسفل، واختبر حظك لكسب العملات! 🔥');

            const gamesMenu = new StringSelectMenuBuilder()
                .setCustomId('games_select_menu')
                .setPlaceholder('...اختر اللعبة أو الفعالية')
                .addOptions([
                    { label: 'لعبة الروليت', description: 'راهن بلونك المفضل وضاعف عملاتك (أحمر، أسود، أخضر)', value: 'play_roulette', emoji: '🎰' },
                    { label: 'ملك أو كتابة', description: 'تحدي سريع لطرد الحظ (ملك أو كتابة)', value: 'play_coinflip', emoji: '🪙' },
                    { label: 'تحدي النرد', description: 'ارْمِ النرد ونافس البوت برقم أعلى', value: 'play_dice', emoji: '🎲' }
                ]);

            const row = new ActionRowBuilder().addComponents(gamesMenu);

            try {
                await targetChannel.send({ embeds: [menuEmbed], components: [row] });
                await interaction.reply({ content: `✅ **تم إرسال لوحة الفعاليات والألعاب إلى الروم بنجاح!**`, ephemeral: true });
            } catch (error) {
                await interaction.reply({ content: `❌ حدث خطأ أثناء إرسال اللوحة.`, ephemeral: true });
            }
        }

        else if (commandName === 'event') {
            if (!member.permissions.has(PermissionFlagsBits.Administrator)) {
                return interaction.reply({ content: `❌ هذا الأمر للإدارة فقط!`, ephemeral: true });
            }
            const prize = options.getString('الجائزة');
            const eventEmbed = new EmbedBuilder()
                .setColor('#ff0055')
                .setTitle('🔥 فعالية جديدة في سيرفر فيم!')
                .setDescription(`الجائزة الكبرى: **${prize}**\nاضغط على الزر بالأسفل للمشاركة وسحب الفائز!`)
                .setTimestamp();

            const joinButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('join_event_btn').setLabel('مشاركة بالفعالية 🎟️').setStyle(ButtonStyle.Success)
            );

            await interaction.channel.send({ embeds: [eventEmbed], components: [joinButton] });
            await interaction.reply({ content: `✅ تم إطلاق الفعالية بنجاح في الروم!`, ephemeral: true });
        }
        else if (commandName === 'تكت') {
            const targetChannel = options.getChannel('الروم');
            const customTitle = options.getString('العنوان') || '🎟️ إنشاء تكت جديد';
            const customDesc = options.getString('الوصف') || 'اختر القسم المناسب من القائمة بالأسفل لفتح تكت خاص بك';
            const colorSelection = options.getString('اللون') || 'blue';
            const customImage = options.getString('الصورة');

            const colorMap = {
                purple: '#9b59b6',
                pink: '#ff69b4',
                red: '#ff0000',
                blue: '#0099ff',
                green: '#2ecc71',
                gold: '#f1c40f',
                dark: '#2b2d31',
                white: '#ffffff'
            };

            const embedColor = colorMap[colorSelection] || '#0099ff';

            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId('ticket_select_menu')
                .setPlaceholder('...اختر القسم المناسب')
                .addOptions([
                    { label: 'طلب كلب', description: 'لطلبات الكلاب', value: 'dog_ticket', emoji: '🐕' },
                    { label: 'طلب كلبه', description: 'لطلبات الكلاب (إناث)', value: 'female_dog_ticket', emoji: '🐩' },
                    { label: 'طلب ممحونه', description: 'للقسم الخاص', value: 'm_ticket', emoji: '🔥' },
                    { label: 'طلب فيمبوي', description: 'لطلبات الفيمبوي', value: 'femboy_ticket', emoji: '🌸' },
                    { label: 'دعم فني', description: 'للدعم الفني والاستفسارات', value: 'support_ticket', emoji: '🛠️' },
                    { label: 'شكوى', description: 'لتقديم الشكاوي والبلاغات', value: 'complaint_ticket', emoji: '⚠️' }
                ]);

            const row = new ActionRowBuilder().addComponents(selectMenu);
            const embed = new EmbedBuilder().setColor(embedColor).setTitle(customTitle).setDescription(customDesc);
            if (customImage) embed.setImage(customImage);

            try {
                await targetChannel.send({ embeds: [embed], components: [row] });
                await interaction.reply({ content: `✅ **تم إرسال لوحة التكت إلى الروم بنجاح!**`, ephemeral: true });
            } catch (error) {
                await interaction.reply({ content: `❌ **حدث خطأ، تأكد من صحة الرابط.**`, ephemeral: true });
            }
        }
        else if (commandName === 'مسح') {
            const count = options.getInteger('عدد');
            if (count < 1 || count > 100) return interaction.reply({ content: '❌ يجب اختيار عدد بين 1 و 100.', ephemeral: true });
            try {
                await interaction.channel.bulkDelete(count, true);
                const reply = await interaction.reply({ content: `✅ **تم مسح ${count} رسالة بنجاح.**`, ephemeral: true });
                setTimeout(() => reply.delete().catch(() => {}), 4000);
            } catch (error) {
                await interaction.reply({ content: '❌ حدث خطأ أثناء مسح الرسائل.', ephemeral: true });
            }
        }
    }

    // --- تفاعلات حجز المقاعد والتصفية الحية ---
    if (interaction.isButton()) {
        if (interaction.customId === 'join_elimination_game') {
            const eventData = activeEliminationEvents.get(interaction.message.id);
            if (!eventData) return interaction.reply({ content: `❌ هذه الفعالية انتهت أو غير موجودة.`, ephemeral: true });

            if (eventData.players.includes(user.id)) {
                return interaction.reply({ content: `⚠️ أنت حجزت مقعدك مسبقاً، انتظر البداية!`, ephemeral: true });
            }

            if (eventData.players.length >= eventData.maxSeats) {
                return interaction.reply({ content: `❌ عذراً، اكتمل عدد المقاعد بالكامل!`, ephemeral: true });
            }

            eventData.players.push(user.id);
            await interaction.reply({ content: `✅ تم حجز مقعدك بنجاح! (${eventData.players.length}/${eventData.maxSeats}) 🪑`, ephemeral: true });

            // إذا اكتملت المقاعد، تبدأ الحفلة والتصفية فوراً!
            if (eventData.players.length === eventData.maxSeats) {
                eventData.status = 'playing';
                const channel = interaction.channel;

                await channel.send(`🚨 **اكتملت جميع المقاعد! بدأت لعبة روليت المراكز الحية... جاري تصفية اللاعبين واحد ورا الثاني! ⏳**`);

                let currentPlayers = [...eventData.players];

                // حلقة الحذف التدريجي (كل 4 ثواني يطير شخص لين يبقى الفائز الأخير)
                const eliminationInterval = setInterval(async () => {
                    if (currentPlayers.length <= 1) {
                        clearInterval(eliminationInterval);
                        const winnerId = currentPlayers[0];
                        
                        // إضافة الجائزة للفائز
                        if (!economy[winnerId]) economy[winnerId] = { coins: 100, inventory: [], lastDaily: 0 };
                        economy[winnerId].coins += eventData.prize;
                        saveEconomy();

                        await channel.send(`🏆 **انتهت اللعبة! صمد للنهاية وفاز بالمركز الأول وصاحب الجائزة <@${winnerId}>!**\n🎉 مبروك كسبت **${eventData.prize}** عملة! 👑`);
                        activeEliminationEvents.delete(interaction.message.id);
                        return;
                    }

                    // استبعاد شخص عشوائي
                    const randomIndex = Math.floor(Math.random() * currentPlayers.length);
                    const eliminatedPlayer = currentPlayers.splice(randomIndex, 1)[0];

                    await channel.send(`❌ **طارت الكرسي واستبعدنا:** <@${eliminatedPlayer}> 💨 (باقي في المنافسة: ${currentPlayers.length} أشخاص)`);
                }, 4000);
            }
        }
        else if (interaction.customId === 'join_event_btn') {
            if (!economy[user.id]) economy[user.id] = { coins: 100, inventory: [], lastDaily: 0 };
            economy[user.id].coins += 20;
            saveEconomy();
            await interaction.reply({ content: `🎉 تم تسطير اسمك في الفعالية! وكسبت **20 عملة** كمكافأة مشاركة!`, ephemeral: true });
        }
        else if (interaction.customId === 'close_custom_ticket') {
            const channel = interaction.channel;
            await interaction.reply({ content: '🔒 **جاري قفل الروم وحذفه خلال 3 ثوان...**', ephemeral: true });
            setTimeout(() => { channel.delete().catch(() => {}); }, 3000);
        }
    }

    // تفاعلات القائمة المنسدلة للألعاب السريعة
    if (interaction.isStringSelectMenu() && interaction.customId === 'games_select_menu') {
        const selectedGame = interaction.values[0];
        if (!economy[user.id]) economy[user.id] = { coins: 100, inventory: [], lastDaily: 0 };

        if (selectedGame === 'play_roulette') {
            const betAmount = 50;
            if (economy[user.id].coins < betAmount) {
                return interaction.reply({ content: `❌ رصيدك ما يكفي للرهان (تحتاج 50 عملة كحد أدنى)!`, ephemeral: true });
            }
            const chance = Math.floor(Math.random() * 38) + 1;
            let resultColor = chance === 1 ? 'green' : (chance % 2 === 0 ? 'red' : 'black');
            const colorNames = { red: 'أحمر 🔴', black: 'أسود ⬛', green: 'أخضر 🟩' };

            if (resultColor === 'red' || resultColor === 'green') {
                const won = resultColor === 'green' ? betAmount * 14 : betAmount * 2;
                economy[user.id].coins += (won - betAmount);
                saveEconomy();
                await interaction.reply({ content: `🎰 **عجلة الروليت طاحت على:** ${colorNames[resultColor]}\n🎉 **كفو فزت!** كسبت **${won}** عملة!`, ephemeral: true });
            } else {
                economy[user.id].coins -= betAmount;
                saveEconomy();
                await interaction.reply({ content: `🎰 **عجلة الروليت طاحت على:** ${colorNames[resultColor]}\n❌ **خسرت!** راحت عليك **${betAmount}** عملة.`, ephemeral: true });
            }
        }
        else if (selectedGame === 'play_coinflip') {
            const betAmount = 50;
            if (economy[user.id].coins < betAmount) {
                return interaction.reply({ content: `❌ رصيدك ما يكفي للرهان (تحتاج 50 عملة)!`, ephemeral: true });
            }
            const botResult = Math.random() < 0.5 ? 'heads' : 'tails';
            const names = { heads: 'ملك 👑', tails: 'كتابة 📜' };
            if (botResult === 'heads') {
                economy[user.id].coins += betAmount;
                saveEconomy();
                await interaction.reply({ content: `🪙 **العملة طاحت على:** ${names[botResult]}\n🔥 **فزت بالتحدي!** كسبت **${betAmount * 2}** عملة!`, ephemeral: true });
            } else {
                economy[user.id].coins -= betAmount;
                saveEconomy();
                await interaction.reply({ content: `🪙 **العملة طاحت على:** ${names[botResult]}\n❌ **خسرت!** خصمنا **${betAmount}** عملة.`, ephemeral: true });
            }
        }
        else if (selectedGame === 'play_dice') {
            const betAmount = 50;
            if (economy[user.id].coins < betAmount) {
                return interaction.reply({ content: `❌ رصيدك ما يكفي للرهان (تحتاج 50 عملة)!`, ephemeral: true });
            }
            const userRoll = Math.floor(Math.random() * 6) + 1;
            const botRoll = Math.floor(Math.random() * 6) + 1;

            if (userRoll > botRoll) {
                economy[user.id].coins += betAmount;
                saveEconomy();
                await interaction.reply({ content: `🎲 **رميت النرد جبت:** [ ${userRoll} ] | **البوت:** [ ${botRoll} ]\n🏆 **فزت!** كسبت **${betAmount}** عملة!`, ephemeral: true });
            } else if (userRoll < botRoll) {
                economy[user.id].coins -= betAmount;
                saveEconomy();
                await interaction.reply({ content: `🎲 **رميت النرد جبت:** [ ${userRoll} ] | **البوت:** [ ${botRoll} ]\n💥 **خسرت!** راح منك **${betAmount}** عملة.`, ephemeral: true });
            } else {
                await interaction.reply({ content: `🎲 **تعادل!** كليكم جبتوا [ ${userRoll} ]، ما تغير شي برصيدك.`, ephemeral: true });
            }
        }
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'ticket_select_menu') {
        const guild = interaction.guild;
        const member = interaction.member;
        const selectedValue = interaction.values[0];
        
        let categoryName = `تكت-جديد`;
        if (selectedValue === 'dog_ticket') categoryName = `كلب-${member.user.username}`;
        else if (selectedValue === 'female_dog_ticket') categoryName = `كلبه-${member.user.username}`;
        else if (selectedValue === 'm_ticket') categoryName = `ممحونه-${member.user.username}`;
        else if (selectedValue === 'femboy_ticket') categoryName = `فيمبوي-${member.user.username}`;
        else if (selectedValue === 'support_ticket') categoryName = `دعم-${member.user.username}`;
        else if (selectedValue === 'complaint_ticket') categoryName = `شكوى-${member.user.username}`;

        try {
            const ticketChannel = await guild.channels.create({
                name: categoryName,
                type: 0,
                permissionOverwrites: [
                    { id: guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                    { id: member.id, allow: [PermissionFlagsBits.ViewChannel,PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
                ]
            });

            const closeButton = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('close_custom_ticket').setLabel('قفل الروم').setStyle(ButtonStyle.Danger).setEmoji('🔒')
            );

            const welcomeEmbed = new EmbedBuilder()
                .setColor('#9b59b6')
                .setTitle('**🎟️ تم إنشاء التكت بنجاح**')
                .setDescription(`مرحباً بك ${member}، لقد تم فتح تكت خاص بك. سيتم خدمتك قريباً.`);

            await ticketChannel.send({ content: `${member}`, embeds: [welcomeEmbed], components: [closeButton] });
            await interaction.reply({ content: `✅ **تم إنشاء التكت الخاص بك بنجاح:** ${ticketChannel}`, ephemeral: true });
        } catch (error) {
            await interaction.reply({ content: '❌ حدث خطأ أثناء إنشاء التكت.', ephemeral: true });
        }
    }
});

client.login('MTU2Mzc1NzA1NDg4NjE1ODQ3Ng.GYSKFS.Ncckk-VCfUSbE5Jh7DLMxWeKVY8ci3K1Mpa9cc');
