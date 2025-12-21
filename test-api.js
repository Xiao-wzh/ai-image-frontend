// 简单测试脚本，模拟 API 调用
const fs = require('fs');
const path = require('path');

async function testApi() {
  try {
    // 读取一个图片文件作为测试
    const imagePath = path.join(__dirname, 'public', 'next.svg');
    const imageBuffer = fs.readFileSync(imagePath);
    
    // 创建 FormData
    const formData = new FormData();
    formData.append('productName', 'Test Product');
    formData.append('productType', 'Sticker');
    formData.append('image', new Blob([imageBuffer]), 'next.svg');
    
    // 发送请求
    const response = await fetch('http://localhost:3000/api/generate', {
      method: 'POST',
      body: formData
    });
    
    const result = await response.json();
    console.log('Response status:', response.status);
    console.log('Response:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Error:', error);
  }
}

testApi();
