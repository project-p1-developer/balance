const express = require('express');
const { User, Task, sequelize } = require('./models');
const redis = require('./redis');
const {tasks} = require('./tasks.js');

const app = express();
app.use(express.json());

const PORT = 3001;
const MAX_TASK_DURATION_SEC = 1000; // We assume none of the tasks will run longer than that

app.patch('/balance', async (req, res) => {
    const { userId, amount } = req.body;

    const transaction = await sequelize.transaction();

    try {
        // Lock the specific user row until the transaction completes
        const user = await User.findByPk(userId, {
            lock: transaction.LOCK.UPDATE,
            transaction
        });
        if (!user) {
            await transaction.rollback();
            return res.status(404).send({ error: 'User not found' });
        }

        if (user.balance - amount < 0) {
            await transaction.rollback();
            return res.status(400).send({ error: 'Insufficient funds' });
        }

        user.balance -= amount;
        await user.save({ transaction });

        // Commit the transaction
        await transaction.commit();

        res.send({ newBalance: user.balance });
    } catch (err) {
        // If there's any error, roll back the transaction
        if (transaction) await transaction.rollback();
        res.status(500).send({ error: 'Internal server error' });
    }
});

app.get('/tasks', async (req, res) => {
    console.log('Getting the tasks statuses from Redis')
    const taskStatuses = await redis.hgetall('task_statuses');
    const result = {}
    const now = new Date()
    for (let taskId in taskStatuses) {
        const taskStatus = JSON.parse(taskStatuses[taskId]);
        if (taskStatus.status === 'running'){
            taskStatus.durationMsec = now.getTime() - new Date(taskStatus.timestamp)
        }
        result[taskId] = taskStatus
    }
    res.json(result);
});

app.post('/task', async (req, res) => {
    const taskId = req.body.taskId;
    let workerId = process.pid;
    console.log(`Worker ${workerId} received task #${taskId}`);
    const task = tasks.find(t => t.id === taskId);
    if (!task) {
        res.send ({
            error: `Task ${taskId} is not found`
        })
    }

    const isLocked = await redis.set(task.id, 'locked', 'NX', 'EX', MAX_TASK_DURATION_SEC);

    if (isLocked) {
        try {
            const startTime = new Date()
            await redis.hset('task_statuses', task.id, JSON.stringify({status: 'running', workerId, timestamp: startTime }));
            await task.fn();
            const endTime = new Date()
            await redis.hset('task_statuses', task.id, JSON.stringify({status: 'completed', workerId, timestamp: endTime}));
            await Task.create({
                taskId: task.id,
                workerId,
                startTime,
                endTime
            });
        } catch (error) {
            await redis.hset('task_statuses', task.id, JSON.stringify({status: 'failed', workerId, timestamp: new Date().getTime()}));
        } finally {
            await redis.del(task.id);
        }
        res.send({
            message: `Task processed`,
            workerId: workerId
        });
    } else {
        res.send({
            message: `Task is currently in progress, skip creating another instance`,
            workerId: workerId
        });
    }
})

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});