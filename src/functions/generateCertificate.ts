import { APIGatewayProxyHandler } from "aws-lambda";
import { document } from "../utils/dynamodbClient";
import handlebars from "handlebars";
import dayjs from 'dayjs';
import chromium from "chrome-aws-lambda";
import path from 'path'
import fs from 'fs'

interface ICreateCertificate {
  id: string;
  name: string;
  grade: string;
}

interface ITemplate extends ICreateCertificate {
  medal: string;
  date: string;
}

const compile = async (data: ITemplate) => {
  const filePath = path.join(process.cwd(), 'src', 'templates', 'certificate.hbs');
  const html = fs.readFileSync(filePath, 'utf-8');

  return handlebars.compile(html)(data);
}

export const handler: APIGatewayProxyHandler = async (event) => {
  const { id, name, grade } = JSON.parse(event.body) as ICreateCertificate;

  await document.put({
    TableName: 'users_certificate',
    Item: {
      id: id,
      name,
      grade,
      created_at: new Date().getTime(),
    }
  }).promise();

  const response = await document.query({
    TableName: 'users_certificate',
    KeyConditionExpression: 'id = :id',
    ExpressionAttributeValues: {
      ':id': id,
    },
  }).promise();

  const medalPath = path.join(process.cwd(), 'src', 'templates', 'selo.png');
  const medal = fs.readFileSync(medalPath, 'base64');

  const data: ITemplate = {
    date: dayjs().format("DD/MM/YYYY"),
    grade,
    name,
    id,
    medal,
  }


  const content = await compile(data);

  const browser = await chromium.puppeteer.launch({
    args: chromium.args,
    defaultViewport: chromium.defaultViewport,
    executablePath: await chromium.executablePath,
    headless: chromium.headless,
    userDataDir: '/dev/null',
  });

  const page = await browser.newPage();
  await page.setContent(content);
  const pdf = await page.pdf({
    format: 'a4',
    landscape: true,
    printBackground: true,
    path: process.env.IS_OFFLINE ? './certificate.pdf' : null,
    preferCSSPageSize: true,
  });

  await browser.close();

  return {
    statusCode: 201,
    body: JSON.stringify(response.Items[0]),
  }
};
