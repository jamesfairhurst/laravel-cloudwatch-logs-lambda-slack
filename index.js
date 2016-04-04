var zlib = require('zlib');
var https = require('https');
var slackPostPath, slackBotUsername, slackBotIconEmoji, totalRequests, completedRequests;

slackPostPath = '/services/xxx/xxx/xxx';
slackBotUsername = 'Laravel Logs';
slackBotIconEmoji = ':bell:';

function processLogEvent(logEvent, context) {
    var date = new Date(logEvent.timestamp);

    // Nasty way to grab log type & message (need to learn regular expressions!!)
    var split1 = logEvent.message.split(']');
    var split2 = split1[1].trim().split(':');
    var split3 = split2[0].split('.');

    var logTitle = split2[0].trim();
    var logMessage = logEvent.message.split('\n')[0].trim();
    var logType = split3[1];

    postToSlack(logTitle, logMessage, logType, context);
}

function postToSlack(logTitle, logMessage, logType, context) {
    var payloadStr = JSON.stringify({
        'username': slackBotUsername,
        'attachments': [
            {
                'title': logTitle,
                'fallback': logMessage,
                'text': logMessage,
                'color': getLogTypeColour(logType)
            }
        ],
        'icon_emoji': slackBotIconEmoji,
    });

    var options = {
        hostname: 'hooks.slack.com',
        port: 443,
        path: slackPostPath,
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(payloadStr),
        }
    };

    var postReq = https.request(options, function(res) {
        var chunks = [];
        res.setEncoding('utf8');
        res.on('data', function(chunk) {
            return chunks.push(chunk);
        });
        res.on('end', function() {
            var body = chunks.join('');

            if (res.statusCode < 400) {
                console.info('Message posted successfully');
            } else if (res.statusCode < 500) {
                console.error("Error posting message to Slack API: " + res.statusCode + " - " + res.statusMessage);
            } else {
                console.error("Server error when processing message: " + res.statusCode + " - " + res.statusMessage);
            }

            if (completedRequests++ == totalRequests - 1) {
                context.succeed('DONE');
            }
        });
        return res;
    });

    postReq.write(payloadStr);
    postReq.end();
}

// Nice colours in Slack depending on Log Type
// Palette from http://hoarrd.github.io/drunken-parrot-flat-ui/#colors
function getLogTypeColour(logType) {
    var colour = 'cc0000';

    if (logType == 'ALERT') {
        colour = 'f84545';
    } else if (logType == 'CRITICAL') {
        colour = 'e96300';
    } else if (logType == 'ERROR') {
        colour = 'f58410';
    } else if (logType == 'WARNING') {
        colour = 'a88cd5';
    } else if (logType == 'NOTICE') {
        colour = 'fad46b';
    } else if (logType == 'INFO') {
        colour = '02baf2';
    } else if (logType == 'DEBUG') {
        colour = '364347';
    }

    return colour;
}

exports.handler = function(event, context) {
    var payload = new Buffer(event.awslogs.data, 'base64');
    zlib.gunzip(payload, function(e, result) {
        if (e) {
            context.fail(e);
        } else {
            result = JSON.parse(result.toString('utf8'));
            console.log("Decoded payload: ", JSON.stringify(result));

            completedRequests = 0;
            totalRequests = result.logEvents.length;

            result.logEvents.forEach(function (logEvent) {
                processLogEvent(logEvent, context);
            });
        }
    });
};