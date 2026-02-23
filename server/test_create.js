const http = require('http');

const data = JSON.stringify({
  subjectId: "some-subject-id",
  classIds: ["some-class-id"],
  teacherIds: ["some-teacher-id"],
  count: 1,
  length: 1,
  roomType: "REGULAR",
  isMeeting: false,
  title: ""
});

const req = http.request(
  {
    hostname: 'localhost',
    port: 3001,
    path: '/api/lesson-config',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length
    }
  },
  res => {
    let body = '';
    res.on('data', d => body += d);
    res.on('end', () => console.log('Response:', res.statusCode, body));
  }
);
// we don't have an auth token here, wait this requires auth...
