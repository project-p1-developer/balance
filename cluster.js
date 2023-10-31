const cluster = require('cluster');
const cron = require("node-cron");
const axios = require("axios");
const numCPUs = require('os').cpus().length;
const {tasks} = require('./tasks.js');

const PORT = 3001;

if (cluster.isMaster) {
    console.log(`Master ${process.pid} is running`);

    for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
    }

    cluster.on('exit', (worker, code, signal) => {
        console.log(`Worker ${worker.process.pid} died. Will be replaced by the new worker`);
        cluster.fork();
    });

    startTasks(tasks)

} else {
    require('./app.js');
}

function startTasks() {
    const targetUrl = `http://127.0.0.1:${PORT}/task`;
    console.log('tasks', tasks)
    tasks.forEach(task => {
        console.log(`Scheduling the task ${task.id}`)
        cron.schedule(task.interval, async () => {
            console.log(`Sending the request to start the task ${task.id}`)
            const payload = {taskId: task.id};
            const response = await axios.post(targetUrl, payload);
            console.log(`Request results for task ${task.id}:`, response.data)
        });
    });
}
