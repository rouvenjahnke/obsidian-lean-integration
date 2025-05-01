import { h } from 'preact';
import { useEffect } from 'preact/hooks';
import { createStore } from 'zustand';
import { LeanClient } from '../leanClient';
import { LeanGoal } from '../types/lean-types';
import { TacticSuggestions } from './TacticSuggestions';

// Define the store for goals
interface GoalState {
  goals: LeanGoal[];
  setGoals: (goals: LeanGoal[]) => void;
  selectGoal: (goalId: string | null) => void;
  selectedGoalId: string | null;
}

// Create the store
export const useGoalStore = createStore<GoalState>((set) => ({
  goals: [],
  selectedGoalId: null,
  setGoals: (goals) => set({ goals }),
  selectGoal: (goalId) => set({ selectedGoalId: goalId }),
}));

interface GoalPanelProps {
  onGoalClick: (goal: LeanGoal) => void;
  leanClient: LeanClient;
  onApplyTactic: (tactic: string, goal: LeanGoal) => void;
}

export const GoalPanel = ({ 
  onGoalClick, 
  leanClient, 
  onApplyTactic 
}: GoalPanelProps) => {
  const { goals, selectedGoalId, selectGoal } = useGoalStore();
  const selectedGoal = goals.find(g => g.id === selectedGoalId);

  // Format the tactic state for rendering
  const formatTacticState = (state: string): string => {
    return state.replace(/\\n/g, '\n');
  };

  // Handle clicking on a goal
  const handleGoalClick = (goal: LeanGoal) => {
    selectGoal(goal.id);
    onGoalClick(goal);
  };

  // Handle applying a tactic to the current goal
  const handleApplyTactic = (tactic: string) => {
    if (selectedGoal) {
      onApplyTactic(tactic, selectedGoal);
    }
  };

  // If goals list changes and the selected goal is no longer valid, 
  // select the first goal or null
  useEffect(() => {
    if (selectedGoalId && !goals.some(g => g.id === selectedGoalId)) {
      selectGoal(goals.length > 0 ? goals[0].id : null);
    }
  }, [goals, selectedGoalId]);

  // Render an individual goal
  const renderGoal = (goal: LeanGoal) => {
    const isSelected = goal.id === selectedGoalId;
    
    return (
      <div 
        key={goal.id}
        className={`lean-goal ${isSelected ? 'lean-goal-selected' : ''}`}
        onClick={() => handleGoalClick(goal)}
      >
        <div className="lean-goal-header">
          <span className="lean-goal-location">
            Line {goal.range.start.line + 1}
          </span>
        </div>
        <pre className="lean-goal-content">
          {formatTacticState(goal.tacticState)}
        </pre>
      </div>
    );
  };

  return (
    <div className="lean-goals-panel">
      <div className="lean-goals-header">
        <h4>Lean Goals</h4>
      </div>
      
      <div className="lean-goals-content">
        {goals.length === 0 ? (
          <div className="lean-no-goals">No active goals</div>
        ) : (
          goals.map(renderGoal)
        )}
      </div>
      
      {selectedGoal && (
        <div className="lean-tactics-panel">
          <TacticSuggestions
            leanClient={leanClient}
            goal={selectedGoal}
            onApplyTactic={handleApplyTactic}
          />
        </div>
      )}
      
      <div className="lean-goals-help">
        <details>
          <summary>Help</summary>
          <div className="lean-help-content">
            <p>
              <strong>Goals Panel</strong> shows the current proof obligations in your Lean file.
            </p>
            <ul>
              <li>Click on a goal to navigate to its location in the document</li>
              <li>Use suggested tactics from the Tactics panel to make progress on proofs</li>
              <li>Goals update automatically as you edit your Lean code</li>
            </ul>
          </div>
        </details>
      </div>
    </div>
  );
};

export default GoalPanel;