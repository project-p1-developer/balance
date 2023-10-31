async function taskFunction(taskId, timeoutSeconds) {
    console.log(`${taskId} started. Timeout = ${timeoutSeconds} sec.`);
    await new Promise(res => setTimeout(res, timeoutSeconds * 1000));
    console.log(`${taskId} finished.`);
}

function getTask(taskId, scheduleMinutes, timeoutSeconds) {
    return {
        id: taskId,
        interval: `*/${scheduleMinutes} * * * *`,
        fn: async () => taskFunction(taskId, timeoutSeconds)
    }
}

const tasks = [
    getTask('Task1', 1, 120),
    getTask('Task2', 2, 121),
    getTask('Task3', 1, 122),
    getTask('Task4', 2, 123),
    getTask('Task5', 1, 124),
    getTask('Task6', 2, 125),
    getTask('Task7', 1, 126),
    getTask('Task8', 2, 127),
    getTask('Task9', 1, 128),
    getTask('Task10', 2, 129),
];

exports.tasks = tasks
