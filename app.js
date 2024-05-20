const TelegramBot = require('node-telegram-bot-api');
const mysql = require('mysql');

// 配置 Telegram 机器人
const bot = new TelegramBot('6787357076:AAHeFDv4RA_mSF93fyY92GYSELmTSc7dj4w', { polling: true });

// 配置 MySQL 数据库连接
const dbConnection = mysql.createConnection({
  host: 'localhost',
  user: 'root',
  password: 'admin',
  database: 'jizhang2',
});

// 连接到数据库
dbConnection.connect((err) => {
  if (err) {
    console.error('数据库连接失败:', err);
  } else {
    console.log('已成功连接到数据库');
  }
});

// 初始化群的账单记录
const groupTransactions = {};

// 处理消息
bot.onText(/([-+]?\d+)\s*/, (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username; // 获取操作人的用户名
  const amount = parseInt(match[1]);

  // 获取当前日期
  const currentDate = new Date().toISOString().split('T')[0];

  // 初始化群的账单记录
  if (!groupTransactions[chatId]) {
    groupTransactions[chatId] = [];
  }

  // 保存记录到数据库
  const sql = 'INSERT INTO transactions (chat_id, user_id, username, amount, date) VALUES (?, ?, ?, ?, ?)';
  dbConnection.query(sql, [chatId, userId, username, amount, currentDate], (err) => {
    if (err) {
      console.error('数据库插入错误:', err);
    } else {
      console.log('记录已插入到数据库');
    }
  });

  // 更新群的账单记录，限制最多保存10条数据
  if (groupTransactions[chatId].length >= 10) {
    groupTransactions[chatId].shift(); // 移除最旧的一条数据
  }
  groupTransactions[chatId].push({ date: currentDate, username, amount });

  // 发送回复消息
  const reply = generateBillReply(groupTransactions[chatId]);
  bot.sendMessage(chatId, reply);
});

// 生成账单回复
function generateBillReply(transactions) {
  let reply = '今日账单：\n\n';
  for (const transaction of transactions) {
    reply += `${transaction.date} ${transaction.amount > 0 ? '|' + '+' : '|' + '-'}${Math.abs(transaction.amount)}\n`;
  }
  const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  reply += `\n总和: ${total}`;
  return reply;
}

// 启动 Telegram 机器人
bot.on('polling_error', (error) => {
  console.error('Telegram 机器人出错:', error);
});

// 当应用程序关闭时关闭数据库连接
process.on('SIGINT', () => {
  dbConnection.end();
  process.exit();
});

// 处理查询今日账单请求
bot.onText(/\今日账单/, (msg) => {
  const chatId = msg.chat.id;
  const currentDate = new Date().toISOString().split('T')[0];

  // 查询数据库中今天的记录
  const query = 'SELECT username, amount, date FROM transactions WHERE chat_id = ? AND date = ?';
  dbConnection.query(query, [chatId, currentDate], (err, rows) => {
    if (err) {
      console.error('数据库查询错误:', err);
    } else {
      let reply = '今日账单：\n\n';
      let total = 0;
      for (const row of rows) {
        const username = row.username;
        const amount = row.amount;
        const transactionDate = row.date;
        reply += `@${username} |${transactionDate} |${amount > 0 ? '+' : '-'}${Math.abs(amount)}\n`;
        total += Math.abs(amount); // 累加绝对值
      }
      reply += `\n总和: ${total}`;
      bot.sendMessage(chatId, reply);
    }
  });
});
/// 处理管理员清除账单命令
bot.onText(/清除账单/, (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
  
    // 这里可以添加逻辑，检查用户是否为管理员，可以根据你的需求自定义管理员角色的判定方法
  
    // 清除群的账单记录
    groupTransactions[chatId] = [];
  
    // 清除数据库中今天的账单记录
    const currentDate = new Date().toISOString().split('T')[0];
    const deleteQuery = 'DELETE FROM transactions WHERE chat_id = ? AND date = ?';
    dbConnection.query(deleteQuery, [chatId, currentDate], (err) => {
      if (err) {
        console.error('数据库删除错误:', err);
        bot.sendMessage(chatId, '清除账单失败，请稍后重试。');
      } else {
        // 发送清除成功消息
        bot.sendMessage(chatId, '账单已清除，可以开始新的记账。');
      }
    });
});
