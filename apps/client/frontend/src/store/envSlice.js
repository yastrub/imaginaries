import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  isTerminalApp: false,
};

const envSlice = createSlice({
  name: 'env',
  initialState,
  reducers: {
    setIsTerminalApp(state, action) {
      state.isTerminalApp = !!action.payload;
    },
  },
});

export const { setIsTerminalApp } = envSlice.actions;
export default envSlice.reducer;
