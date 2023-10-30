const express = require('express');
const { User, sequelize } = require('./models');

const app = express();
app.use(express.json());

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

const PORT = 3001;

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
