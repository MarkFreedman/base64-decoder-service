const { exec } = require('child_process');
const util = require('util');

const execPromise = util.promisify(exec);

/**
 * Run a shell command and return stdout
 * @param {string} command
 * @returns {Promise<string>}
 */
async function execCommand(command) {
  try {
    const { stdout, stderr } = await execPromise(command);
    if (stderr) {
      console.error(`Shell stderr: ${stderr}`);
    }
    return stdout.trim();
  } catch (error) {
    console.error(`Shell command failed: ${command}`);
    console.error(error);
    throw new Error(`Command failed: ${error.message}`);
  }
}

module.exports = {
  execCommand,
};
