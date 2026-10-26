import axios from 'axios';

const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api/',
});
export const getProfile = (userId) => API.get(`profile/${userId}/`);
export const updateProfile = (userId, formData) => API.put(`profile/${userId}/`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
});
// Add this export at the bottom of the file
export const updateAttendance = (id, data) => API.patch(`attendance/${id}/`, data);
export const registerUser = (data) => API.post('register/', data);
export const loginUser = (data) => API.post('login/', data);
export const managerCreateUser = (data) => API.post('manager/create-user/', data);
export const getAttendance = () => API.get('attendance/');
export const markAttendance = (data) => API.post('attendance/', data);
export const getSMTPSettings = () => API.get('smtp-settings/');
export const saveSMTPSettings = (data) => API.post('smtp-settings/', data);
// Add this line to your existing exports
export const changePassword = (data) => API.post('change-password/', data);
// Add these exports at the bottom of the file
export const getUsers = () => API.get('users/');
export const updateUser = (id, data) => API.put(`users/${id}/`, data);
export const deleteUser = (id) => API.delete(`users/${id}/`);
// Append these to your api.js exports
export const getSchedules = () => API.get('schedules/');
export const saveSchedule = (data) => API.post('schedules/save/', data);
export const deleteSchedule = (dateStr) => API.delete(`schedules/${dateStr}/`);
export const getLeaveRequests = () => API.get('leaves/');
export const createLeaveRequest = (data) => API.post('leaves/', data);
export const updateLeaveRequest = (id, data) => API.patch(`leaves/${id}/`, data);
export const getLeaveAllocations = () => API.get('leave-allocations/');
export const createLeaveAllocation = (data) => API.post('leave-allocations/', data);
export const deleteLeaveAllocation = (id) => API.delete(`leave-allocations/${id}/`);
export const deleteLeaveRequest = (id) => API.delete(`leaves/${id}/`);


export default API;